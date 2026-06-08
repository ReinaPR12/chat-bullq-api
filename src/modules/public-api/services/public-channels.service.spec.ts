import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { PublicChannelsService } from './public-channels.service';
import type { PublicChannelCaller } from './public-channels.service';

/**
 * These tests pin the multi-tenant contract of the Public Channels API:
 * every operation must delegate to ChannelsService scoped to the org inferred
 * from the API key, and cross-org access (NotFound/Forbidden from the internal
 * service) must propagate unchanged. ChannelsService is fully mocked — no IO.
 */
describe('PublicChannelsService', () => {
  let channels: jest.Mocked<any>;
  let service: PublicChannelsService;

  const caller: PublicChannelCaller = {
    organizationId: 'org-A',
    userOrganizationId: 'uo-1',
    role: OrgRole.OWNER,
    access: 'ALL',
  };

  beforeEach(() => {
    channels = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      testConnection: jest.fn(),
      syncChannel: jest.fn(),
      getSyncStatus: jest.fn(),
      cancelSync: jest.fn(),
    };
    service = new PublicChannelsService(channels);
  });

  it('create: scopes to the key org, defaults config to {}, passes creator', async () => {
    channels.create.mockResolvedValue({ id: 'c1' });
    await service.create({ type: 'WHATSAPP_ZAPPFY' as any, name: 'N' }, caller);
    expect(channels.create).toHaveBeenCalledWith(
      'org-A',
      expect.objectContaining({ type: 'WHATSAPP_ZAPPFY', name: 'N', config: {} }),
      { userOrganizationId: 'uo-1', role: OrgRole.OWNER },
    );
  });

  it('findAll: lists only the key org channels with its access set', async () => {
    channels.findAll.mockResolvedValue([{ id: 'c1' }]);
    const res = await service.findAll(caller);
    expect(channels.findAll).toHaveBeenCalledWith('org-A', 'ALL');
    expect(res).toEqual([{ id: 'c1' }]);
  });

  it('findOne: denies cross-org (propagates ForbiddenException)', async () => {
    channels.findOne.mockRejectedValue(new ForbiddenException());
    await expect(service.findOne('c-other', caller)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(channels.findOne).toHaveBeenCalledWith('c-other', 'org-A', 'ALL');
  });

  it('remove: verifies ownership via findOne then soft-deletes with the real name', async () => {
    channels.findOne.mockResolvedValue({ id: 'c1', name: 'Vendas' });
    channels.remove.mockResolvedValue({ id: 'c1' });
    const res = await service.remove('c1', caller);
    expect(channels.findOne).toHaveBeenCalledWith('c1', 'org-A', 'ALL');
    expect(channels.remove).toHaveBeenCalledWith('c1', 'org-A', 'Vendas');
    expect(res).toEqual({ ok: true, id: 'c1' });
  });

  it('remove: does NOT delete when the channel is from another org', async () => {
    channels.findOne.mockRejectedValue(new NotFoundException());
    await expect(service.remove('c-other', caller)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(channels.remove).not.toHaveBeenCalled();
  });

  it('testConnection: maps internal result to {ok, status, detail}', async () => {
    channels.findOne.mockResolvedValue({ id: 'c1' });
    channels.testConnection.mockResolvedValue({
      success: true,
      status: 'connected',
      data: { phone: '+55' },
    });
    const res = await service.testConnection('c1', caller);
    expect(res).toEqual({
      ok: true,
      status: 'connected',
      detail: { phone: '+55' },
    });
  });

  it('testConnection: failure maps to ok=false with error detail', async () => {
    channels.findOne.mockResolvedValue({ id: 'c1' });
    channels.testConnection.mockResolvedValue({
      success: false,
      error: 'bad token',
    });
    const res = await service.testConnection('c1', caller);
    expect(res).toEqual({ ok: false, status: 'error', detail: 'bad token' });
  });

  it('syncChannel: returns {jobId, status} on success', async () => {
    channels.findOne.mockResolvedValue({ id: 'c1' });
    channels.syncChannel.mockResolvedValue({
      success: true,
      jobId: 'job-1',
      status: 'PENDING',
    });
    const res = await service.syncChannel('c1', caller);
    expect(res).toEqual({ jobId: 'job-1', status: 'PENDING' });
  });

  it('getSyncStatus: returns {status, progress} computed from imported/total', async () => {
    channels.findOne.mockResolvedValue({ id: 'c1' });
    channels.getSyncStatus.mockResolvedValue({
      job: {
        status: 'RUNNING',
        conversationsImported: 5,
        conversationsTotal: 10,
      },
    });
    const res = await service.getSyncStatus('c1', caller);
    expect(res.status).toBe('RUNNING');
    expect(res.progress).toBe(50);
  });

  it('cancelSync: returns {ok:true, status}', async () => {
    channels.findOne.mockResolvedValue({ id: 'c1' });
    channels.cancelSync.mockResolvedValue({ job: { status: 'CANCELLED' } });
    const res = await service.cancelSync('c1', caller);
    expect(res).toEqual({
      ok: true,
      status: 'CANCELLED',
      job: { status: 'CANCELLED' },
    });
  });
});
