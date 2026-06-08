import { MessageStatus } from '@prisma/client';
import { InboundMessageProcessor } from './inbound-message.processor';

/**
 * Pins the CRM mirroring of provider acks. The processor updates the message
 * status (never regressing) and then emits `message.status` to the CRM ONLY
 * when the status actually advanced — guaranteeing idempotency / no flood on
 * repeated delivered/read acks. All IO is mocked.
 */
describe('InboundMessageProcessor.processStatus → CRM emission', () => {
  let prisma: any;
  let realtimeGateway: any;
  let webhookEvents: any;
  let outboundWebhook: any;
  let processor: InboundMessageProcessor;

  function buildMessage(status: MessageStatus) {
    return {
      id: 'msg-1',
      externalId: 'ext-abc',
      conversationId: 'conv-1',
      status,
      sentAt: null,
      deliveredAt: null,
      readAt: null,
    };
  }

  beforeEach(() => {
    prisma = {
      message: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    realtimeGateway = { emitToConversation: jest.fn() };
    webhookEvents = { markProcessed: jest.fn() };
    outboundWebhook = { emitMessageStatus: jest.fn().mockResolvedValue(undefined) };

    // Only the deps touched by processStatus need real stubs; the rest are
    // never reached on this path, so empty objects are enough.
    processor = new InboundMessageProcessor(
      prisma,
      {} as any, // idempotency
      {} as any, // contactResolver
      {} as any, // conversationResolver
      realtimeGateway,
      {} as any, // instagramEnricher
      {} as any, // zappfyEnricher
      webhookEvents,
      {} as any, // agentRouter
      {} as any, // agentRunner
      {} as any, // transcription
      {} as any, // outbox
      {} as any, // watchdog
      outboundWebhook,
      {} as any, // chatbotQueue
    );
  });

  function callProcessStatus(data: any) {
    return (processor as any).processStatus(data);
  }

  it('emits message.status when the status advances (SENT → DELIVERED)', async () => {
    const ts = new Date('2026-06-07T10:00:00.000Z');
    prisma.message.findFirst.mockResolvedValue(buildMessage(MessageStatus.SENT));
    prisma.message.update.mockResolvedValue({ status: MessageStatus.DELIVERED });

    await callProcessStatus({
      channelId: 'chan-1',
      status: { externalMessageId: 'ext-abc', status: 'delivered', timestamp: ts },
    });

    expect(outboundWebhook.emitMessageStatus).toHaveBeenCalledTimes(1);
    expect(outboundWebhook.emitMessageStatus).toHaveBeenCalledWith({
      channelId: 'chan-1',
      conversationId: 'conv-1',
      messageId: 'msg-1',
      externalMessageId: 'ext-abc',
      status: 'delivered',
      timestamp: ts,
      errorMessage: undefined,
    });
  });

  it('does NOT emit when the status did not advance (repeated DELIVERED ack)', async () => {
    prisma.message.findFirst.mockResolvedValue(buildMessage(MessageStatus.DELIVERED));
    prisma.message.update.mockResolvedValue({ status: MessageStatus.DELIVERED });

    await callProcessStatus({
      channelId: 'chan-1',
      status: {
        externalMessageId: 'ext-abc',
        status: 'delivered',
        timestamp: new Date(),
      },
    });

    expect(outboundWebhook.emitMessageStatus).not.toHaveBeenCalled();
  });

  it('does NOT emit when a stale ack would regress status (READ then DELIVERED)', async () => {
    prisma.message.findFirst.mockResolvedValue(buildMessage(MessageStatus.READ));
    prisma.message.update.mockResolvedValue({ status: MessageStatus.READ });

    await callProcessStatus({
      channelId: 'chan-1',
      status: {
        externalMessageId: 'ext-abc',
        status: 'delivered',
        timestamp: new Date(),
      },
    });

    expect(outboundWebhook.emitMessageStatus).not.toHaveBeenCalled();
  });

  it('maps FAILED and forwards the error message', async () => {
    prisma.message.findFirst.mockResolvedValue(buildMessage(MessageStatus.SENT));
    prisma.message.update.mockResolvedValue({ status: MessageStatus.FAILED });

    await callProcessStatus({
      channelId: 'chan-1',
      status: {
        externalMessageId: 'ext-abc',
        status: 'failed',
        timestamp: new Date(),
        errorMessage: 'invalid number',
      },
    });

    expect(outboundWebhook.emitMessageStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', errorMessage: 'invalid number' }),
    );
  });

  it('does nothing for unknown external message ids', async () => {
    prisma.message.findFirst.mockResolvedValue(null);

    await callProcessStatus({
      channelId: 'chan-1',
      status: { externalMessageId: 'nope', status: 'read', timestamp: new Date() },
    });

    expect(prisma.message.update).not.toHaveBeenCalled();
    expect(outboundWebhook.emitMessageStatus).not.toHaveBeenCalled();
  });
});
