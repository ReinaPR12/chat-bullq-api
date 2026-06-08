import { createHmac } from 'crypto';
import axios from 'axios';
import { OutboundWebhookService } from './outbound-webhook.service';

jest.mock('axios');

/**
 * Pins the outbound webhook contract toward the CRM. All IO (axios) is mocked.
 * Focus: the `message.status` event shape + HMAC signing are reused from the
 * inbound path, and delivery stays best-effort (never throws).
 */
describe('OutboundWebhookService.emitMessageStatus', () => {
  const URL = 'https://crm.example/v1/integrations/whatsapp/webhooks/bullq';
  const SECRET = 'top-secret';
  let service: OutboundWebhookService;
  const post = axios.post as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRM_WEBHOOK_URL = URL;
    process.env.CRM_WEBHOOK_SECRET = SECRET;
    service = new OutboundWebhookService();
    post.mockResolvedValue({ status: 200 });
  });

  afterEach(() => {
    delete process.env.CRM_WEBHOOK_URL;
    delete process.env.CRM_WEBHOOK_SECRET;
  });

  it('POSTs a signed message.status event with the CRM-shaped payload', async () => {
    const ts = new Date('2026-06-07T12:00:00.000Z');

    await service.emitMessageStatus({
      channelId: 'chan-1',
      conversationId: 'conv-1',
      messageId: 'msg-1',
      externalMessageId: 'ext-abc',
      status: 'delivered',
      timestamp: ts,
    });

    expect(post).toHaveBeenCalledTimes(1);
    const [calledUrl, body, options] = post.mock.calls[0];
    expect(calledUrl).toBe(URL);

    const payload = JSON.parse(body);
    expect(payload).toEqual({
      event: 'message.status',
      channelId: 'chan-1',
      conversationId: 'conv-1',
      message: {
        id: 'msg-1',
        externalMessageId: 'ext-abc',
        status: 'delivered',
        errorMessage: null,
        timestamp: ts.toISOString(),
      },
    });

    // Same HMAC-SHA256 signing scheme as the inbound path.
    const expectedSig = createHmac('sha256', SECRET).update(body).digest('hex');
    expect(options.headers['x-bullq-signature']).toBe(expectedSig);
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('carries errorMessage on failed status', async () => {
    await service.emitMessageStatus({
      channelId: 'c',
      conversationId: 'v',
      messageId: 'm',
      externalMessageId: 'e',
      status: 'failed',
      errorMessage: 'number not on whatsapp',
    });

    const payload = JSON.parse(post.mock.calls[0][1]);
    expect(payload.message.status).toBe('failed');
    expect(payload.message.errorMessage).toBe('number not on whatsapp');
  });

  it('is a no-op when CRM_WEBHOOK_URL is unset', async () => {
    delete process.env.CRM_WEBHOOK_URL;
    service = new OutboundWebhookService();

    await service.emitMessageStatus({
      channelId: 'c',
      conversationId: 'v',
      messageId: 'm',
      status: 'sent',
    });

    expect(post).not.toHaveBeenCalled();
  });

  it('never throws when delivery fails (best-effort)', async () => {
    post.mockRejectedValue(new Error('CRM down'));

    await expect(
      service.emitMessageStatus({
        channelId: 'c',
        conversationId: 'v',
        messageId: 'm',
        status: 'read',
      }),
    ).resolves.toBeUndefined();
  });
});
