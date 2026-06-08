import { BadRequestException, Injectable } from '@nestjs/common';
import { ConversationsService } from '../../messaging/conversations/conversations.service';
import { MessagesService } from '../../messaging/messages/messages.service';
import type { ChannelAccess } from '../../iam/channel-access/channel-access.service';
import type { PublicUpdateConversationDto } from '../dto/public-conversation.dto';

export interface PublicConversationsCaller {
  organizationId: string;
  /** API key holder — acts as the actor for state changes / read state. */
  userId: string;
  access: ChannelAccess;
}

export interface PublicConversationListFilters {
  channelId?: string;
  status?: string;
  search?: string;
  assignedTo?: string;
  /** INDIVIDUAL | GROUP — maps to the internal `kind` filter. */
  kind?: 'INDIVIDUAL' | 'GROUP';
}

/**
 * Thin Public-API wrapper over the internal ConversationsService /
 * MessagesService. The CRM (Meridial) proxies BullQ as the source of truth for
 * listing and opening conversations.
 *
 * Multi-tenant safety is NOT re-implemented here: the internal services already
 * enforce it. Every call passes the org inferred from the API key AND the
 * key holder's `accessibleChannelIds` (ChannelAccess). The internal layer
 * throws ForbiddenException on cross-org / cross-channel access and NotFound
 * when the id doesn't exist — both propagate unchanged.
 *
 * This layer only adapts the response into a stable public contract (envelope,
 * field names) so the CRM/frontend can bind to it without coupling to the
 * internal Prisma row shape.
 */
@Injectable()
export class PublicConversationsService {
  constructor(
    private readonly conversations: ConversationsService,
    private readonly messages: MessagesService,
  ) {}

  async list(
    filters: PublicConversationListFilters,
    page: number,
    limit: number,
    caller: PublicConversationsCaller,
  ) {
    const result = await this.conversations.findInbox(
      caller.organizationId,
      {
        status: filters.status,
        channelId: filters.channelId,
        assignedToId: filters.assignedTo,
        search: filters.search,
        kind: filters.kind,
      },
      page,
      limit,
      caller.access,
      caller.userId,
    );

    return {
      conversations: result.conversations.map((c) => this.toListItem(c)),
      pagination: result.pagination,
    };
  }

  async get(id: string, caller: PublicConversationsCaller) {
    const conversation = await this.conversations.findOne(
      id,
      caller.organizationId,
      caller.access,
    );
    return this.toDetail(conversation);
  }

  async messagesFor(
    id: string,
    page: number,
    limit: number,
    caller: PublicConversationsCaller,
  ) {
    const result = await this.messages.findByConversation(
      id,
      caller.organizationId,
      page,
      limit,
      caller.access,
    );
    return {
      messages: result.messages.map((m) => this.toMessage(m)),
      pagination: result.pagination,
    };
  }

  async update(
    id: string,
    dto: PublicUpdateConversationDto,
    caller: PublicConversationsCaller,
  ) {
    // `unread` is handled by a dedicated per-user read-state path on the
    // internal service, not by ConversationsService.update. Process it first
    // (and on its own) so a caller can flip read-state without touching
    // status/assignment.
    if (dto.unread !== undefined) {
      if (dto.unread) {
        await this.conversations.markAsUnread(
          id,
          caller.organizationId,
          caller.userId,
          caller.access,
        );
      } else {
        await this.conversations.markAsRead(
          id,
          caller.organizationId,
          caller.userId,
          caller.access,
        );
      }
    }

    const hasFieldUpdate =
      dto.status !== undefined || dto.assignedTo !== undefined;

    if (!hasFieldUpdate) {
      if (dto.unread === undefined) {
        throw new BadRequestException(
          'Nothing to update: provide at least one of status, assignedTo, unread.',
        );
      }
      // unread-only change: return the current detail so the caller gets a
      // consistent envelope back.
      return this.get(id, caller);
    }

    const updated = await this.conversations.update(
      id,
      caller.organizationId,
      {
        status: dto.status,
        assignedToId: dto.assignedTo,
      },
      caller.userId,
      caller.access,
    );
    return this.toDetail(updated);
  }

  // ─── Mappers ──────────────────────────────────────────────────────────────
  // Kept private and pure so the public contract is defined in exactly one
  // place. `any` is intentional: the internal Prisma includes vary between
  // findInbox (slim) and findById (rich); we read defensively from both.

  private toListItem(c: any) {
    const last = Array.isArray(c.messages) ? c.messages[0] : undefined;
    return {
      id: c.id,
      channelId: c.channelId,
      contact: this.toContact(c.contact),
      lastMessage: last
        ? {
            preview: this.preview(last),
            type: last.type,
            timestamp: this.iso(last.createdAt),
            direction: last.direction,
          }
        : null,
      unreadCount: typeof c.unreadCount === 'number' ? c.unreadCount : 0,
      status: c.status,
      assignedTo: this.toAssignee(c.assignedTo),
      updatedAt: this.iso(c.updatedAt),
      isGroup: !!c.isGroup,
      kind: c.isGroup ? 'GROUP' : 'INDIVIDUAL',
    };
  }

  private toDetail(c: any) {
    return {
      id: c.id,
      channelId: c.channelId,
      contact: this.toContact(c.contact),
      status: c.status,
      assignedTo: this.toAssignee(c.assignedTo),
      subject: c.subject ?? null,
      protocol: c.protocol ?? null,
      isGroup: !!c.isGroup,
      kind: c.isGroup ? 'GROUP' : 'INDIVIDUAL',
      isArchived: !!c.isArchived,
      lastMessageAt: this.iso(c.lastMessageAt),
      createdAt: this.iso(c.createdAt),
      updatedAt: this.iso(c.updatedAt),
    };
  }

  private toMessage(m: any) {
    const content = (m.content ?? {}) as Record<string, any>;
    const text =
      typeof content.text === 'string'
        ? content.text
        : typeof content.caption === 'string'
          ? content.caption
          : null;
    const mediaUrl =
      (typeof content.mediaUrl === 'string' && content.mediaUrl) ||
      (typeof content.url === 'string' && content.url) ||
      null;
    const mime =
      (typeof content.mimeType === 'string' && content.mimeType) ||
      (typeof content.mimetype === 'string' && content.mimetype) ||
      null;
    return {
      id: m.id,
      externalMessageId: m.externalId ?? null,
      direction: m.direction,
      type: m.type,
      content,
      text,
      mediaUrl,
      mime,
      status: m.status,
      timestamp: this.iso(m.createdAt),
      fromMe: m.direction === 'OUTBOUND',
    };
  }

  private toContact(contact: any) {
    if (!contact) return null;
    return {
      id: contact.id,
      name: contact.name ?? null,
      phone: contact.phone ?? null,
      profilePicUrl: contact.avatarUrl ?? null,
    };
  }

  private toAssignee(assignedTo: any) {
    if (!assignedTo) return null;
    return {
      id: assignedTo.id,
      name: assignedTo.name ?? null,
      avatarUrl: assignedTo.avatarUrl ?? null,
    };
  }

  private preview(msg: any): string {
    const content = (msg.content ?? {}) as Record<string, any>;
    if (typeof content.text === 'string' && content.text) return content.text;
    if (typeof content.caption === 'string' && content.caption) {
      return content.caption;
    }
    return `[${String(msg.type ?? 'message').toLowerCase()}]`;
  }

  private iso(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    return value instanceof Date ? value.toISOString() : value;
  }
}
