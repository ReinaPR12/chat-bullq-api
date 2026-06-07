import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MessageContentType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { ContactResolverService } from '../../messaging/pipeline/contact-resolver.service';
import { ConversationResolverService } from '../../messaging/pipeline/conversation-resolver.service';
import { MessagesService } from '../../messaging/messages/messages.service';
import type { NormalizedInboundMessage } from '../../channel-hub/ports/types/normalized-message.types';

export interface PublicSendParams {
  organizationId: string;
  senderId: string;
  channelId: string;
  toPhone: string;
  type?: string;
  content: Record<string, any>;
}

/**
 * Orquestra o envio server-to-server (API key) reusando o pipeline existente:
 * resolve/cria o contato e a conversa a partir de (channelId, telefone) e
 * delega o envio ao MessagesService — exatamente o caminho do inbound, ao
 * contrário, garantindo um único contato/conversa por telefone+canal.
 */
@Injectable()
export class PublicMessagesService {
  private readonly logger = new Logger(PublicMessagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contactResolver: ContactResolverService,
    private readonly conversationResolver: ConversationResolverService,
    private readonly messagesService: MessagesService,
  ) {}

  async sendToPhone(params: PublicSendParams) {
    const { organizationId, senderId, channelId, toPhone, content } = params;
    const type = params.type ?? 'TEXT';

    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, organizationId },
    });
    if (!channel) {
      throw new NotFoundException('Channel not found for this organization');
    }

    const phoneDigits = (toPhone || '').replace(/\D/g, '');
    if (!phoneDigits) {
      throw new BadRequestException('toPhone inválido');
    }

    // Objeto mínimo no formato do pipeline para reusar o ContactResolver.
    // externalContactId = dígitos do telefone (mesmo critério dos adapters de
    // WhatsApp); contactName cai para o telefone quando desconhecido.
    const normalized = {
      externalMessageId: `crm-${randomUUID()}`,
      externalContactId: phoneDigits,
      contactPhone: phoneDigits,
      contactName: phoneDigits,
      channelType: channel.type,
      timestamp: new Date(),
      type: type as MessageContentType,
      content,
    } as unknown as NormalizedInboundMessage;

    const contact = await this.contactResolver.resolve(organizationId, channelId, normalized);
    const conversation = await this.conversationResolver.resolve(
      organizationId,
      channelId,
      contact.contactId,
    );

    const message = await this.messagesService.send(
      { conversationId: conversation.conversationId, type, content },
      senderId,
      organizationId,
      'ALL',
    );

    this.logger.log(
      `Public send enfileirado: conv=${conversation.conversationId} msg=${(message as any)?.id}`,
    );

    return {
      id: (message as any)?.id ?? null,
      conversationId: conversation.conversationId,
      contactId: contact.contactId,
      externalMessageId: (message as any)?.externalId ?? null,
      status: (message as any)?.status ?? 'QUEUED',
    };
  }
}
