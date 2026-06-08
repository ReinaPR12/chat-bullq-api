import { Injectable } from '@nestjs/common';
import { TagsService } from '../../tags/tags.service';
import { PublicCreateTagDto, PublicUpdateTagDto } from '../dto/public-tag.dto';

export interface PublicTagsCaller {
  organizationId: string;
  /** Key holder user id — recorded as the actor on tag apply/remove. */
  actorId: string;
}

/**
 * Thin Public-API wrapper over the internal TagsService. Every method is
 * scoped to the organization inferred from the API key. TagsService already
 * enforces org ownership on every operation (NotFound when a tag/conversation/
 * contact belongs to another org), so this layer just adapts ergonomics:
 *   - normalizes DELETE responses to { ok, id },
 *   - passes the key holder as the actor for automation outbox events.
 */
@Injectable()
export class PublicTagsService {
  constructor(private readonly tags: TagsService) {}

  findAll(caller: PublicTagsCaller) {
    return this.tags.findAll(caller.organizationId);
  }

  create(dto: PublicCreateTagDto, caller: PublicTagsCaller) {
    return this.tags.create(caller.organizationId, dto);
  }

  update(id: string, dto: PublicUpdateTagDto, caller: PublicTagsCaller) {
    return this.tags.update(id, caller.organizationId, dto);
  }

  async remove(id: string, caller: PublicTagsCaller) {
    await this.tags.remove(id, caller.organizationId);
    return { ok: true, id };
  }

  addToConversation(
    conversationId: string,
    tagId: string,
    caller: PublicTagsCaller,
  ) {
    return this.tags.addToConversation(
      conversationId,
      tagId,
      caller.organizationId,
      caller.actorId,
    );
  }

  async removeFromConversation(
    conversationId: string,
    tagId: string,
    caller: PublicTagsCaller,
  ) {
    await this.tags.removeFromConversation(
      conversationId,
      tagId,
      caller.organizationId,
      caller.actorId,
    );
    return { ok: true };
  }

  addToContact(contactId: string, tagId: string, caller: PublicTagsCaller) {
    return this.tags.addToContact(
      contactId,
      tagId,
      caller.organizationId,
      caller.actorId,
    );
  }

  async removeFromContact(
    contactId: string,
    tagId: string,
    caller: PublicTagsCaller,
  ) {
    await this.tags.removeFromContact(
      contactId,
      tagId,
      caller.organizationId,
      caller.actorId,
    );
    return { ok: true };
  }
}
