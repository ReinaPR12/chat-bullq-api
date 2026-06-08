import { NotFoundException } from '@nestjs/common';
import { PublicTagsService } from './public-tags.service';
import type { PublicTagsCaller } from './public-tags.service';

/**
 * Pins the multi-tenant contract of the Public Tags API: every operation
 * delegates to the internal TagsService scoped to the org inferred from the
 * API key, passing the key holder as actor; cross-org access (NotFound from
 * the internal service) propagates unchanged. TagsService is fully mocked.
 */
describe('PublicTagsService', () => {
  let tags: jest.Mocked<any>;
  let service: PublicTagsService;

  const caller: PublicTagsCaller = {
    organizationId: 'org-A',
    actorId: 'user-1',
  };

  beforeEach(() => {
    tags = {
      findAll: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      addToConversation: jest.fn(),
      removeFromConversation: jest.fn(),
      addToContact: jest.fn(),
      removeFromContact: jest.fn(),
    };
    service = new PublicTagsService(tags);
  });

  it('findAll: lists only the key org tags', async () => {
    tags.findAll.mockResolvedValue([{ id: 't1', name: 'VIP', color: '#fff' }]);
    const res = await service.findAll(caller);
    expect(tags.findAll).toHaveBeenCalledWith('org-A');
    expect(res).toEqual([{ id: 't1', name: 'VIP', color: '#fff' }]);
  });

  it('create: scopes to the key org', async () => {
    tags.create.mockResolvedValue({ id: 't1' });
    await service.create({ name: 'VIP', color: '#fff' }, caller);
    expect(tags.create).toHaveBeenCalledWith('org-A', {
      name: 'VIP',
      color: '#fff',
    });
  });

  it('update: scopes to the key org', async () => {
    tags.update.mockResolvedValue({ id: 't1', name: 'New' });
    await service.update('t1', { name: 'New' }, caller);
    expect(tags.update).toHaveBeenCalledWith('t1', 'org-A', { name: 'New' });
  });

  it('update: denies cross-org (propagates NotFoundException)', async () => {
    tags.update.mockRejectedValue(new NotFoundException('Tag not found'));
    await expect(
      service.update('t-other', { name: 'X' }, caller),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tags.update).toHaveBeenCalledWith('t-other', 'org-A', { name: 'X' });
  });

  it('remove: scopes to the key org and returns { ok, id }', async () => {
    tags.remove.mockResolvedValue(undefined);
    const res = await service.remove('t1', caller);
    expect(tags.remove).toHaveBeenCalledWith('t1', 'org-A');
    expect(res).toEqual({ ok: true, id: 't1' });
  });

  it('remove: does NOT swallow cross-org NotFound', async () => {
    tags.remove.mockRejectedValue(new NotFoundException('Tag not found'));
    await expect(service.remove('t-other', caller)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('addToConversation: scopes to key org and passes actor', async () => {
    tags.addToConversation.mockResolvedValue({ conversationId: 'c1', tagId: 't1' });
    await service.addToConversation('c1', 't1', caller);
    expect(tags.addToConversation).toHaveBeenCalledWith(
      'c1',
      't1',
      'org-A',
      'user-1',
    );
  });

  it('addToConversation: denies cross-org conversation (propagates NotFound)', async () => {
    tags.addToConversation.mockRejectedValue(
      new NotFoundException('Conversation not found'),
    );
    await expect(
      service.addToConversation('c-other', 't1', caller),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removeFromConversation: scopes to key org and returns { ok }', async () => {
    tags.removeFromConversation.mockResolvedValue({});
    const res = await service.removeFromConversation('c1', 't1', caller);
    expect(tags.removeFromConversation).toHaveBeenCalledWith(
      'c1',
      't1',
      'org-A',
      'user-1',
    );
    expect(res).toEqual({ ok: true });
  });

  it('addToContact: scopes to key org and passes actor', async () => {
    tags.addToContact.mockResolvedValue({ contactId: 'k1', tagId: 't1' });
    await service.addToContact('k1', 't1', caller);
    expect(tags.addToContact).toHaveBeenCalledWith('k1', 't1', 'org-A', 'user-1');
  });

  it('addToContact: denies cross-org contact (propagates NotFound)', async () => {
    tags.addToContact.mockRejectedValue(new NotFoundException('Contact not found'));
    await expect(
      service.addToContact('k-other', 't1', caller),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removeFromContact: scopes to key org and returns { ok }', async () => {
    tags.removeFromContact.mockResolvedValue({});
    const res = await service.removeFromContact('k1', 't1', caller);
    expect(tags.removeFromContact).toHaveBeenCalledWith(
      'k1',
      't1',
      'org-A',
      'user-1',
    );
    expect(res).toEqual({ ok: true });
  });
});
