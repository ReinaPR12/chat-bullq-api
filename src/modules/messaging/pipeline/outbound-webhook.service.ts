import { createHmac } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * Emite eventos de mensagem para um sistema externo (CRM) via webhook de saída
 * assinado. Configurado por env:
 *   - CRM_WEBHOOK_URL    : endpoint do CRM (ex.: https://api.crm/v1/integrations/whatsapp/webhooks/bullq)
 *   - CRM_WEBHOOK_SECRET : segredo HMAC-SHA256 (header x-bullq-signature)
 *
 * Fire-and-forget: falha de entrega NÃO interrompe o processamento inbound.
 */
@Injectable()
export class OutboundWebhookService {
  private readonly logger = new Logger(OutboundWebhookService.name);

  private get url(): string {
    return (process.env.CRM_WEBHOOK_URL || '').trim();
  }

  private get secret(): string {
    return (process.env.CRM_WEBHOOK_SECRET || '').trim();
  }

  get enabled(): boolean {
    return Boolean(this.url);
  }

  async emitMessageInbound(params: {
    channelId: string;
    conversationId: string;
    savedMessage: any;
    normalized: {
      externalMessageId?: string;
      contactPhone?: string;
      contactName?: string;
      type?: unknown;
      content?: unknown;
      timestamp?: Date;
    };
  }): Promise<void> {
    if (!this.enabled) return;

    const { channelId, conversationId, savedMessage, normalized } = params;
    const payload = {
      event: 'message.inbound',
      channelId,
      conversationId,
      message: {
        id: savedMessage?.id ?? null,
        externalMessageId: savedMessage?.externalId ?? normalized.externalMessageId ?? null,
        direction: 'INBOUND',
        type: String(normalized.type ?? 'TEXT'),
        content: normalized.content ?? {},
        contact: {
          phone: normalized.contactPhone ?? null,
          name: normalized.contactName ?? null,
        },
        timestamp: (normalized.timestamp ?? new Date()).toISOString?.() ?? new Date().toISOString(),
      },
    };

    await this.deliver(payload, `conv=${conversationId}`);
  }

  /**
   * Emite a atualização de status de uma mensagem (ack do provider) para o CRM.
   * Evento `message.status`. O CRM casa a mensagem pelo `externalMessageId`
   * (ou `messageId` interno) e normaliza `status` (queued|sent|delivered|read|failed).
   *
   * Mesmo transporte/assinatura HMAC do {@link emitMessageInbound}. Best-effort:
   * falha de entrega NÃO interrompe o pipeline de status.
   *
   * A idempotência (não floodar o mesmo status repetido) é responsabilidade do
   * caller — só chamar quando o status de fato avançou.
   */
  async emitMessageStatus(params: {
    channelId: string;
    conversationId: string;
    messageId: string;
    externalMessageId?: string | null;
    status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
    timestamp?: Date;
    errorMessage?: string | null;
  }): Promise<void> {
    if (!this.enabled) return;

    const { channelId, conversationId, messageId, externalMessageId, status } = params;
    const payload = {
      event: 'message.status',
      channelId,
      conversationId,
      message: {
        id: messageId,
        externalMessageId: externalMessageId ?? null,
        status,
        errorMessage: params.errorMessage ?? null,
        timestamp:
          (params.timestamp ?? new Date()).toISOString?.() ?? new Date().toISOString(),
      },
    };

    await this.deliver(payload, `conv=${conversationId} msg=${messageId} status=${status}`);
  }

  /**
   * POST assinado (HMAC-SHA256, header x-bullq-signature) para o CRM_WEBHOOK_URL.
   * Fire-and-forget: erros são logados, nunca propagados.
   */
  private async deliver(payload: unknown, context: string): Promise<void> {
    try {
      const body = JSON.stringify(payload);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.secret) {
        headers['x-bullq-signature'] = createHmac('sha256', this.secret).update(body).digest('hex');
      }
      await axios.post(this.url, body, { headers, timeout: 8000 });
    } catch (error) {
      // Não propaga: a origem (inbound/status) já foi persistida; entrega ao CRM é best-effort.
      this.logger.warn(
        `Falha ao entregar webhook de saída ao CRM (${context}): ${
          (error as Error)?.message
        }`,
      );
    }
  }
}
