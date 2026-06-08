import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PublicConversationsService } from './public-conversations.service';
import type { PublicConversationsCaller } from './public-conversations.service';

/**
 * Pins the multi-tenant contract AND the public response shapes of the Public
 * Conversations API. Every operation delegates to the internal
 * ConversationsService / MessagesService scoped to the org inferred from the
 * API key, passing the key holder's accessibleChannelIds (ChannelAccess) and
 * the holder as actor/user. Cross-org (Forbidden) and cross-channel
 * (Forbidden from assertChannelAccess) errors propagate unchanged. The
 * internal services are fully mocked — this layer owns mapping + scoping only.
 */
describe('PublicConversationsService', () => {
  let conversations: jest.Mocked<any>;
  let messages: jest.Mocked<any>;
  let service: PublicConversationsService;

  const access = new Set<string>(['chan-1']);
  const caller: PublicConversationsCaller = {
    organizationId: 'org-A',
    userId: 'user-1',
    access,
  };

  const ts = new Date('2026-06-08T12:00:00.000Z');

  beforeEach(() => {
    conversations = {
      findInbox: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      markAsRead: jest.fn(),
      markAsUnread: jest.fn(),
    };
    messages = {
      findByConversation: jest.fn(),
    };
    service = new PublicConversationsService(conversations, messages);
  });

  describe('list', () => {
    it('forwards filters + org + access + user to findInbox and maps each row', async () => {
      conversations.findInbox.mockResolvedValue({
        conversations: [
          {
            id: 'c1',
            channelId: 'chan-1',
            isGroup: false,
            status: 'OPEN',
            unreadCount: 3,
            updatedAt: ts,
            contact: {
              id: 'k1',
              name: 'Alice',
              phone: '+5511999',
              avatarUrl: 'http://pic',
            },
            assignedTo: { id: 'u9', name: 'Bob', avatarUrl: 'http://b' },
            messages: [
              {
                id: 'm9',
                type: 'TEXT',
                content: { text: 'oi' },
                direction: 'INBOUND',
                createdAt: ts,
              },
            ],
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const res = await service.list(
        {
          channelId: 'chan-1',
          status: 'OPEN',
          search: 'ali',
          assignedTo: 'u9',
          kind: 'INDIVIDUAL',
        },
        1,
        20,
        caller,
      );

      expect(conversations.findInbox).toHaveBeenCalledWith(
        'org-A',
        {
          status: 'OPEN',
          channelId: 'chan-1',
          assignedToId: 'u9',
          search: 'ali',
          kind: 'INDIVIDUAL',
        },
        1,
        20,
        access,
        'user-1',
      );

      expect(res.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
      expect(res.conversations[0]).toEqual({
        id: 'c1',
        channelId: 'chan-1',
        contact: {
          id: 'k1',
          name: 'Alice',
          phone: '+5511999',
          profilePicUrl: 'http://pic',
        },
        lastMessage: {
          preview: 'oi',
          type: 'TEXT',
          timestamp: ts.toISOString(),
          direction: 'INBOUND',
        },
        unreadCount: 3,
        status: 'OPEN',
        assignedTo: { id: 'u9', name: 'Bob', avatarUrl: 'http://b' },
        updatedAt: ts.toISOString(),
        isGroup: false,
        kind: 'INDIVIDUAL',
      });
    });

    it('handles rows with no messages / no assignee / no unreadCount', async () => {
      conversations.findInbox.mockResolvedValue({
        conversations: [
          {
            id: 'c2',
            channelId: 'chan-1',
            isGroup: true,
            status: 'PENDING',
            updatedAt: ts,
            contact: { id: 'k2', name: null, phone: null, avatarUrl: null },
            assignedTo: null,
            messages: [],
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const res = await service.list({}, 1, 20, caller);
      expect(res.conversations[0].lastMessage).toBeNull();
      expect(res.conversations[0].assignedTo).toBeNull();
      expect(res.conversations[0].unreadCount).toBe(0);
      expect(res.conversations[0].kind).toBe('GROUP');
      expect(res.conversations[0].isGroup).toBe(true);
    });

    it('uses [type] preview for non-text last message', async () => {
      conversations.findInbox.mockResolvedValue({
        conversations: [
          {
            id: 'c3',
            channelId: 'chan-1',
            isGroup: false,
            status: 'OPEN',
            updatedAt: ts,
            contact: { id: 'k3' },
            assignedTo: null,
            messages: [
              { id: 'm', type: 'IMAGE', content: {}, direction: 'OUTBOUND', createdAt: ts },
            ],
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });
      const res = await service.list({}, 1, 20, caller);
      expect(res.conversations[0].lastMessage?.preview).toBe('[image]');
    });
  });

  describe('get', () => {
    it('delegates to findOne scoped to org + access and maps to detail', async () => {
      conversations.findOne.mockResolvedValue({
        id: 'c1',
        channelId: 'chan-1',
        status: 'OPEN',
        subject: 'lead',
        protocol: 'P-1',
        isGroup: false,
        isArchived: false,
        lastMessageAt: ts,
        createdAt: ts,
        updatedAt: ts,
        contact: { id: 'k1', name: 'Alice', phone: '+55', avatarUrl: 'http://p' },
        assignedTo: { id: 'u9', name: 'Bob', avatarUrl: null },
      });

      const res = await service.get('c1', caller);
      expect(conversations.findOne).toHaveBeenCalledWith('c1', 'org-A', access);
      expect(res).toEqual({
        id: 'c1',
        channelId: 'chan-1',
        contact: {
          id: 'k1',
          name: 'Alice',
          phone: '+55',
          profilePicUrl: 'http://p',
        },
        status: 'OPEN',
        assignedTo: { id: 'u9', name: 'Bob', avatarUrl: null },
        subject: 'lead',
        protocol: 'P-1',
        isGroup: false,
        kind: 'INDIVIDUAL',
        isArchived: false,
        lastMessageAt: ts.toISOString(),
        createdAt: ts.toISOString(),
        updatedAt: ts.toISOString(),
      });
    });

    it('denies cross-org (propagates ForbiddenException)', async () => {
      conversations.findOne.mockRejectedValue(new ForbiddenException());
      await expect(service.get('c-other', caller)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(conversations.findOne).toHaveBeenCalledWith(
        'c-other',
        'org-A',
        access,
      );
    });

    it('propagates NotFound for unknown conversation', async () => {
      conversations.findOne.mockRejectedValue(
        new NotFoundException('Conversation not found'),
      );
      await expect(service.get('nope', caller)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('denies cross-channel (assertChannelAccess Forbidden propagates)', async () => {
      // findOne internally calls channelAccess.assertChannelAccess(access, channelId)
      // which throws Forbidden when the conversation's channel is outside the key's
      // accessibleChannelIds. We simulate that propagation here.
      conversations.findOne.mockRejectedValue(new ForbiddenException());
      await expect(service.get('c-on-chan-2', caller)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('messagesFor', () => {
    it('delegates to MessagesService scoped to org + access and maps messages', async () => {
      messages.findByConversation.mockResolvedValue({
        messages: [
          {
            id: 'm1',
            externalId: 'wamid.X',
            direction: 'INBOUND',
            type: 'TEXT',
            content: { text: 'hello' },
            status: 'DELIVERED',
            createdAt: ts,
          },
          {
            id: 'm2',
            externalId: null,
            direction: 'OUTBOUND',
            type: 'IMAGE',
            content: { mediaUrl: 'http://img', mimetype: 'image/jpeg', caption: 'cap' },
            status: 'SENT',
            createdAt: ts,
          },
        ],
        pagination: { page: 1, limit: 30, total: 2, totalPages: 1 },
      });

      const res = await service.messagesFor('c1', 1, 30, caller);
      expect(messages.findByConversation).toHaveBeenCalledWith(
        'c1',
        'org-A',
        1,
        30,
        access,
      );
      expect(res.pagination.total).toBe(2);
      expect(res.messages[0]).toEqual({
        id: 'm1',
        externalMessageId: 'wamid.X',
        direction: 'INBOUND',
        type: 'TEXT',
        content: { text: 'hello' },
        text: 'hello',
        mediaUrl: null,
        mime: null,
        status: 'DELIVERED',
        timestamp: ts.toISOString(),
        fromMe: false,
      });
      expect(res.messages[1]).toEqual({
        id: 'm2',
        externalMessageId: null,
        direction: 'OUTBOUND',
        type: 'IMAGE',
        content: { mediaUrl: 'http://img', mimetype: 'image/jpeg', caption: 'cap' },
        text: 'cap',
        mediaUrl: 'http://img',
        mime: 'image/jpeg',
        status: 'SENT',
        timestamp: ts.toISOString(),
        fromMe: true,
      });
    });

    it('denies cross-org / cross-channel (propagates ForbiddenException)', async () => {
      messages.findByConversation.mockRejectedValue(new ForbiddenException());
      await expect(
        service.messagesFor('c-other', 1, 30, caller),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('update', () => {
    it('forwards status + assignedTo to ConversationsService.update with actor + access', async () => {
      conversations.update.mockResolvedValue({
        id: 'c1',
        channelId: 'chan-1',
        status: 'CLOSED',
        isGroup: false,
        createdAt: ts,
        updatedAt: ts,
        contact: { id: 'k1' },
        assignedTo: { id: 'u9', name: 'Bob', avatarUrl: null },
      });

      const res = await service.update(
        'c1',
        { status: 'CLOSED' as any, assignedTo: 'u9' },
        caller,
      );

      expect(conversations.update).toHaveBeenCalledWith(
        'c1',
        'org-A',
        { status: 'CLOSED', assignedToId: 'u9' },
        'user-1',
        access,
      );
      expect(res.status).toBe('CLOSED');
      expect(res.id).toBe('c1');
    });

    it('unread=true marks unread for the key holder and returns current detail', async () => {
      conversations.markAsUnread.mockResolvedValue({ ok: true, unreadCount: 1 });
      conversations.findOne.mockResolvedValue({
        id: 'c1',
        channelId: 'chan-1',
        status: 'OPEN',
        isGroup: false,
        createdAt: ts,
        updatedAt: ts,
        contact: { id: 'k1' },
        assignedTo: null,
      });

      const res = await service.update('c1', { unread: true }, caller);
      expect(conversations.markAsUnread).toHaveBeenCalledWith(
        'c1',
        'org-A',
        'user-1',
        access,
      );
      expect(conversations.update).not.toHaveBeenCalled();
      expect(res.id).toBe('c1');
    });

    it('unread=false marks read for the key holder', async () => {
      conversations.markAsRead.mockResolvedValue({ ok: true });
      conversations.findOne.mockResolvedValue({
        id: 'c1',
        channelId: 'chan-1',
        status: 'OPEN',
        isGroup: false,
        createdAt: ts,
        updatedAt: ts,
        contact: { id: 'k1' },
        assignedTo: null,
      });

      await service.update('c1', { unread: false }, caller);
      expect(conversations.markAsRead).toHaveBeenCalledWith(
        'c1',
        'org-A',
        'user-1',
        access,
      );
    });

    it('combines unread + status: read-state first, then field update', async () => {
      conversations.markAsRead.mockResolvedValue({ ok: true });
      conversations.update.mockResolvedValue({
        id: 'c1',
        channelId: 'chan-1',
        status: 'OPEN',
        isGroup: false,
        createdAt: ts,
        updatedAt: ts,
        contact: { id: 'k1' },
        assignedTo: null,
      });

      await service.update('c1', { unread: false, status: 'OPEN' as any }, caller);
      expect(conversations.markAsRead).toHaveBeenCalled();
      expect(conversations.update).toHaveBeenCalledWith(
        'c1',
        'org-A',
        { status: 'OPEN', assignedToId: undefined },
        'user-1',
        access,
      );
    });

    it('rejects an empty body', async () => {
      await expect(service.update('c1', {}, caller)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(conversations.update).not.toHaveBeenCalled();
    });

    it('denies cross-org update (propagates ForbiddenException)', async () => {
      conversations.update.mockRejectedValue(new ForbiddenException());
      await expect(
        service.update('c-other', { status: 'CLOSED' as any }, caller),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
