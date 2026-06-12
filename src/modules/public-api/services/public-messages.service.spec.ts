import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PublicMessagesService } from './public-messages.service';

/**
 * Pins the sendToConversation contract:
 *   - enqueues on the given conversation (delegates to messagesService.send)
 *   - rejects a conversation belonging to a different org (ForbiddenException)
 *   - returns same shape as sendToPhone: { id, conversationId, contactId, externalMessageId, status }
 *
 * sendToPhone regression is covered implicitly (service internals unchanged).
 */
describe('PublicMessagesService — sendToConversation', () => {
  let prisma: jest.Mocked<any>;
  let messagesService: jest.Mocked<any>;
  let service: PublicMessagesService;

  // Shared fixtures
  const ORG_ID = 'org-A';
  const CHANNEL_ID = 'chan-1';
  const CONV_ID = 'conv-123';
  const SENDER_ID = 'user-1';

  beforeEach(() => {
    prisma = {
      channel: { findFirst: jest.fn() },
      conversation: { findUnique: jest.fn() },
    };

    messagesService = {
      send: jest.fn(),
    };

    // We construct the service injecting mocks.
    // PublicMessagesService constructor: (prisma, contactResolver, conversationResolver, messagesService)
    // sendToConversation only needs prisma + messagesService, so we pass nulls for resolvers.
    service = new PublicMessagesService(
      prisma,
      null as any, // contactResolver — not used by sendToConversation
      null as any, // conversationResolver — not used by sendToConversation
      messagesService,
    );
  });

  it('enqueues on the given conversation and returns the expected shape', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: CONV_ID,
      organizationId: ORG_ID,
      channelId: CHANNEL_ID,
      contactId: 'contact-1',
    });
    messagesService.send.mockResolvedValue({
      id: 'msg-uuid',
      externalId: 'wamid.XYZ',
      status: 'QUEUED',
    });

    const result = await service.sendToConversation({
      organizationId: ORG_ID,
      senderId: SENDER_ID,
      conversationId: CONV_ID,
      type: 'TEXT',
      content: { text: 'Olá!' },
    });

    expect(prisma.conversation.findUnique).toHaveBeenCalledWith({
      where: { id: CONV_ID },
    });

    expect(messagesService.send).toHaveBeenCalledWith(
      { conversationId: CONV_ID, type: 'TEXT', content: { text: 'Olá!' } },
      SENDER_ID,
      ORG_ID,
      'ALL',
    );

    expect(result).toEqual({
      id: 'msg-uuid',
      conversationId: CONV_ID,
      contactId: 'contact-1',
      externalMessageId: 'wamid.XYZ',
      status: 'QUEUED',
    });
  });

  it('throws NotFoundException when conversation does not exist', async () => {
    prisma.conversation.findUnique.mockResolvedValue(null);

    await expect(
      service.sendToConversation({
        organizationId: ORG_ID,
        senderId: SENDER_ID,
        conversationId: 'nonexistent',
        type: 'TEXT',
        content: { text: 'hi' },
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws ForbiddenException when conversation belongs to a different org', async () => {
    prisma.conversation.findUnique.mockResolvedValue({
      id: CONV_ID,
      organizationId: 'org-OTHER',
      channelId: CHANNEL_ID,
      contactId: 'contact-1',
    });

    await expect(
      service.sendToConversation({
        organizationId: ORG_ID,
        senderId: SENDER_ID,
        conversationId: CONV_ID,
        type: 'TEXT',
        content: { text: 'hi' },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(messagesService.send).not.toHaveBeenCalled();
  });
});
