import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PublicInboxViewsService } from './public-inbox-views.service';
import type { PublicInboxViewsCaller } from './public-inbox-views.service';

/**
 * Pins the multi-tenant contract of the Public Inbox Views API: every
 * operation delegates to the internal InboxViewsService scoped to BOTH the
 * org inferred from the API key AND the key holder user; cross-org / cross-user
 * access (Forbidden/NotFound from the internal service) propagates unchanged.
 * InboxViewsService is fully mocked — no IO.
 */
describe('PublicInboxViewsService', () => {
  let inbox: jest.Mocked<any>;
  let service: PublicInboxViewsService;

  const caller: PublicInboxViewsCaller = {
    organizationId: 'org-A',
    userId: 'user-1',
    access: 'ALL',
  };

  beforeEach(() => {
    inbox = {
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      reorder: jest.fn(),
      findConversations: jest.fn(),
    };
    service = new PublicInboxViewsService(inbox);
  });

  it('list: scopes to key org + holder user', async () => {
    inbox.list.mockResolvedValue([{ id: 'v1', name: 'Pendentes' }]);
    const res = await service.list(caller);
    expect(inbox.list).toHaveBeenCalledWith('org-A', 'user-1');
    expect(res).toEqual([{ id: 'v1', name: 'Pendentes' }]);
  });

  it('create: scopes to key org + holder user', async () => {
    inbox.create.mockResolvedValue({ id: 'v1' });
    const dto = { name: 'Minha', filters: { statuses: ['OPEN'] } } as any;
    await service.create(dto, caller);
    expect(inbox.create).toHaveBeenCalledWith('org-A', 'user-1', dto);
  });

  it('update: scopes to key org + holder user', async () => {
    inbox.update.mockResolvedValue({ id: 'v1', name: 'New' });
    const dto = { name: 'New' } as any;
    await service.update('v1', dto, caller);
    expect(inbox.update).toHaveBeenCalledWith('v1', 'org-A', 'user-1', dto);
  });

  it('update: denies cross-org/user (propagates ForbiddenException)', async () => {
    inbox.update.mockRejectedValue(new ForbiddenException());
    await expect(
      service.update('v-other', { name: 'X' } as any, caller),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(inbox.update).toHaveBeenCalledWith(
      'v-other',
      'org-A',
      'user-1',
      { name: 'X' },
    );
  });

  it('remove: scopes to key org + holder user, returns { ok, id }', async () => {
    inbox.remove.mockResolvedValue(undefined);
    const res = await service.remove('v1', caller);
    expect(inbox.remove).toHaveBeenCalledWith('v1', 'org-A', 'user-1');
    expect(res).toEqual({ ok: true, id: 'v1' });
  });

  it('remove: does NOT swallow cross-user Forbidden', async () => {
    inbox.remove.mockRejectedValue(new ForbiddenException());
    await expect(service.remove('v-other', caller)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('reorder: maps orderedIds to internal ids arg, returns { ok }', async () => {
    inbox.reorder.mockResolvedValue(undefined);
    const res = await service.reorder(['v2', 'v1'], caller);
    expect(inbox.reorder).toHaveBeenCalledWith('org-A', 'user-1', ['v2', 'v1']);
    expect(res).toEqual({ ok: true });
  });

  it('reorder: denies ids from another user (propagates Forbidden)', async () => {
    inbox.reorder.mockRejectedValue(new ForbiddenException());
    await expect(
      service.reorder(['v-other'], caller),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('conversations: scopes to org/user, passes channel access + paging', async () => {
    inbox.findConversations.mockResolvedValue({ data: [], total: 0 });
    await service.conversations('v1', caller, 2, 50, 'foo');
    expect(inbox.findConversations).toHaveBeenCalledWith(
      'v1',
      'org-A',
      'user-1',
      'ALL',
      2,
      50,
      'foo',
    );
  });

  it('conversations: denies view from another user (propagates NotFound)', async () => {
    inbox.findConversations.mockRejectedValue(
      new NotFoundException('Inbox view not found'),
    );
    await expect(
      service.conversations('v-other', caller, 1, 20),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
