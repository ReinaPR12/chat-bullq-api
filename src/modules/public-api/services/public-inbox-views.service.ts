import { Injectable } from '@nestjs/common';
import { InboxViewsService } from '../../inbox-views/inbox-views.service';
import type { ChannelAccess } from '../../iam/channel-access/channel-access.service';
import {
  PublicCreateInboxViewDto,
  PublicUpdateInboxViewDto,
} from '../dto/public-inbox-view.dto';

export interface PublicInboxViewsCaller {
  organizationId: string;
  /** Inbox views are user-scoped; the API key resolves to its holder user. */
  userId: string;
  access: ChannelAccess;
}

/**
 * Thin Public-API wrapper over the internal InboxViewsService. Inbox views are
 * scoped to BOTH the organization inferred from the API key AND the key holder
 * user. InboxViewsService already enforces both (ForbiddenException on org/user
 * mismatch, NotFound when missing), so cross-org / cross-user access is denied
 * for free. This layer just adapts ergonomics:
 *   - normalizes DELETE / reorder responses to { ok },
 *   - maps the public `orderedIds` body to the internal `ids` argument.
 */
@Injectable()
export class PublicInboxViewsService {
  constructor(private readonly inboxViews: InboxViewsService) {}

  list(caller: PublicInboxViewsCaller) {
    return this.inboxViews.list(caller.organizationId, caller.userId);
  }

  create(dto: PublicCreateInboxViewDto, caller: PublicInboxViewsCaller) {
    return this.inboxViews.create(caller.organizationId, caller.userId, dto);
  }

  update(
    id: string,
    dto: PublicUpdateInboxViewDto,
    caller: PublicInboxViewsCaller,
  ) {
    return this.inboxViews.update(id, caller.organizationId, caller.userId, dto);
  }

  async remove(id: string, caller: PublicInboxViewsCaller) {
    await this.inboxViews.remove(id, caller.organizationId, caller.userId);
    return { ok: true, id };
  }

  async reorder(orderedIds: string[], caller: PublicInboxViewsCaller) {
    await this.inboxViews.reorder(
      caller.organizationId,
      caller.userId,
      orderedIds,
    );
    return { ok: true };
  }

  conversations(
    id: string,
    caller: PublicInboxViewsCaller,
    page: number,
    limit: number,
    search?: string,
  ) {
    return this.inboxViews.findConversations(
      id,
      caller.organizationId,
      caller.userId,
      caller.access,
      page,
      limit,
      search,
    );
  }
}
