import { BadRequestException } from '@nestjs/common';
import { PublicMessagesController } from './public-messages.controller';

/**
 * Pins the routing contract of POST /public/messages:
 *   - toPhone only         → calls service.sendToPhone (regression)
 *   - conversationId only  → calls service.sendToConversation
 *   - both present         → throws BadRequestException (400)
 *
 * The guard is bypassed (unit test); org/user are injected directly.
 */
describe('PublicMessagesController — send routing', () => {
  let service: jest.Mocked<any>;
  let media: jest.Mocked<any>;
  let controller: PublicMessagesController;

  const orgId = 'org-A';
  const userId = 'user-1';

  beforeEach(() => {
    service = {
      sendToPhone: jest.fn().mockResolvedValue({ conversationId: 'c1', status: 'QUEUED' }),
      sendToConversation: jest.fn().mockResolvedValue({ conversationId: 'c2', status: 'QUEUED' }),
    };
    media = {};
    controller = new PublicMessagesController(service, media);
  });

  it('toPhone only → calls sendToPhone with correct params', async () => {
    const dto: any = {
      channelId: 'ch-1',
      toPhone: '+5511999998888',
      type: 'TEXT',
      content: { text: 'hi' },
    };

    const result = await controller.send(dto, userId, orgId);

    expect(service.sendToPhone).toHaveBeenCalledWith({
      organizationId: orgId,
      senderId: 'user-1',
      channelId: 'ch-1',
      toPhone: '+5511999998888',
      type: 'TEXT',
      content: { text: 'hi' },
    });
    expect(service.sendToConversation).not.toHaveBeenCalled();
    expect(result).toEqual({ conversationId: 'c1', status: 'QUEUED' });
  });

  it('conversationId only → calls sendToConversation with correct params', async () => {
    const dto: any = {
      channelId: 'ch-1',
      conversationId: 'conv-123',
      type: 'TEXT',
      content: { text: 'oi' },
    };

    const result = await controller.send(dto, userId, orgId);

    expect(service.sendToConversation).toHaveBeenCalledWith({
      organizationId: orgId,
      senderId: 'user-1',
      conversationId: 'conv-123',
      type: 'TEXT',
      content: { text: 'oi' },
    });
    expect(service.sendToPhone).not.toHaveBeenCalled();
    expect(result).toEqual({ conversationId: 'c2', status: 'QUEUED' });
  });

  it('both toPhone + conversationId → throws BadRequestException(400)', async () => {
    const dto: any = {
      channelId: 'ch-1',
      toPhone: '+5511999998888',
      conversationId: 'conv-123',
      type: 'TEXT',
      content: { text: 'conflito' },
    };

    await expect(controller.send(dto, userId, orgId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(service.sendToPhone).not.toHaveBeenCalled();
    expect(service.sendToConversation).not.toHaveBeenCalled();
  });
});
