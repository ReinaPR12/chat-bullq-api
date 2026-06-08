import { Injectable, NotFoundException } from '@nestjs/common';
import { AgentsService } from '../../ai-agents/agents/agents.service';
import { SkillsCatalogService } from '../../ai-agents/catalog/skills.service';
import { ToolsCatalogService } from '../../ai-agents/catalog/tools.service';
import { PendingActionService } from '../../ai-agents/confirmations/pending-action.service';
import { ConversationsService } from '../../messaging/conversations/conversations.service';
import { PrismaService } from '../../../database/prisma.service';
import type { CreateAgentDto } from '../../ai-agents/agents/dto/create-agent.dto';
import type { UpdateAgentDto } from '../../ai-agents/agents/dto/update-agent.dto';
import type { PendingAction } from '../../ai-agents/confirmations/confirmation.types';

export interface PublicAiAgentsCaller {
  organizationId: string;
  /** Key holder user id — recorded as the actor on AI toggles + approvals. */
  actorId: string;
}

/**
 * Thin Public-API wrapper over the internal AI-Agents stack. Every method is
 * scoped to the organization inferred from the API key.
 *
 * The internal services already enforce org ownership on every operation:
 *   - AgentsService takes organizationId on every method (NotFound cross-org).
 *   - Skills/Tools catalog list/findOne are org-scoped.
 *   - ConversationsService.toggleAi calls findOne(org) before mutating.
 *
 * PendingActionService now carries an organizationId column, so isolation is
 * enforced at the data layer: every query here passes caller.organizationId
 * and a cross-org id resolves to "not found". This layer additionally keeps
 * the conversation-join ownership check as belt-and-suspenders (covers any
 * legacy row created before the org-isolation backfill).
 *
 * This wrapper does NOT reimplement any AI logic — it only exposes existing
 * behaviour behind the API key.
 */
@Injectable()
export class PublicAiAgentsService {
  constructor(
    private readonly agents: AgentsService,
    private readonly skills: SkillsCatalogService,
    private readonly tools: ToolsCatalogService,
    private readonly pendingActions: PendingActionService,
    private readonly conversations: ConversationsService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Agents CRUD (organograma) ──────────────────────────────────

  list(caller: PublicAiAgentsCaller) {
    return this.agents.list(caller.organizationId);
  }

  create(dto: CreateAgentDto, caller: PublicAiAgentsCaller) {
    return this.agents.create(caller.organizationId, dto);
  }

  /** Single agent + the skills attached to it (Jarvis detail panel). */
  async findOne(id: string, caller: PublicAiAgentsCaller) {
    const agent = await this.agents.findOne(caller.organizationId, id);
    const skills = await this.agents.listSkills(caller.organizationId, id);
    return { ...agent, skills };
  }

  update(id: string, dto: UpdateAgentDto, caller: PublicAiAgentsCaller) {
    return this.agents.update(caller.organizationId, id, dto);
  }

  async remove(id: string, caller: PublicAiAgentsCaller) {
    await this.agents.softDelete(caller.organizationId, id);
    return { ok: true, id };
  }

  // ─── Catalog (skills + tools disponíveis) ───────────────────────

  /**
   * Combined catalog for the Jarvis "skills/tools" picker. Both lists are
   * org-scoped by the internal catalog services.
   */
  async catalog(caller: PublicAiAgentsCaller) {
    const [skills, tools] = await Promise.all([
      this.skills.list(caller.organizationId),
      this.tools.list(caller.organizationId),
    ]);
    return { skills, tools };
  }

  // ─── Runs (observabilidade Jarvis) ──────────────────────────────

  /** Recent runs of a single agent (org-scoped via AgentsService). */
  runs(id: string, limit: number, caller: PublicAiAgentsCaller) {
    return this.agents.listRuns(caller.organizationId, id, limit);
  }

  // ─── Pending actions (confirmação) ──────────────────────────────

  /**
   * PENDING actions whose conversation belongs to the caller org. Pending
   * actions carry no org column, so we resolve the org through the parent
   * conversation and drop any that don't match.
   */
  async listPendingActions(
    caller: PublicAiAgentsCaller,
  ): Promise<PendingAction[]> {
    // Data-layer isolation: filter by organizationId in the query itself.
    const pending = await this.pendingActions.listByStatus(
      'PENDING',
      undefined,
      caller.organizationId,
    );
    if (pending.length === 0) return [];

    // Belt-and-suspenders: also drop anything whose conversation no longer
    // resolves to the caller org (covers any legacy row not yet backfilled).
    const ownedConversationIds = await this.filterConversationsByOrg(
      pending.map((p) => p.conversationId),
      caller.organizationId,
    );
    return pending.filter((p) => ownedConversationIds.has(p.conversationId));
  }

  async confirmPendingAction(
    id: string,
    caller: PublicAiAgentsCaller,
  ): Promise<PendingAction> {
    await this.assertPendingActionOwnership(id, caller.organizationId);
    // Pass org so the data layer denies cross-org by column too.
    return this.pendingActions.approve(
      id,
      caller.actorId,
      caller.organizationId,
    );
  }

  async rejectPendingAction(
    id: string,
    reason: string,
    caller: PublicAiAgentsCaller,
  ): Promise<PendingAction> {
    await this.assertPendingActionOwnership(id, caller.organizationId);
    return this.pendingActions.reject(
      id,
      caller.actorId,
      reason,
      caller.organizationId,
    );
  }

  // ─── AI toggle por conversa ─────────────────────────────────────

  /** Force AI ON for a conversation (org-scoped via ConversationsService). */
  enableAi(conversationId: string, caller: PublicAiAgentsCaller) {
    return this.conversations.toggleAi(
      conversationId,
      caller.organizationId,
      true,
      caller.actorId,
    );
  }

  /** Force AI OFF (kill switch) for a conversation. */
  disableAi(conversationId: string, caller: PublicAiAgentsCaller) {
    return this.conversations.toggleAi(
      conversationId,
      caller.organizationId,
      false,
      caller.actorId,
    );
  }

  // ─── helpers ────────────────────────────────────────────────────

  /**
   * Loads the action, resolves its conversation org, and throws NotFound when
   * it belongs to another tenant — making cross-org confirm/reject behave like
   * the action simply does not exist (no information leak).
   */
  private async assertPendingActionOwnership(
    id: string,
    organizationId: string,
  ): Promise<void> {
    // Primary check: data-layer org column (a cross-org id resolves to null).
    const action = await this.pendingActions.get(id, organizationId);
    if (!action) throw new NotFoundException('Pending action not found');

    // Belt-and-suspenders: re-derive the org through the parent conversation.
    const owned = await this.filterConversationsByOrg(
      [action.conversationId],
      organizationId,
    );
    if (!owned.has(action.conversationId)) {
      throw new NotFoundException('Pending action not found');
    }
  }

  /** Returns the subset of conversationIds that belong to the org. */
  private async filterConversationsByOrg(
    conversationIds: string[],
    organizationId: string,
  ): Promise<Set<string>> {
    const unique = [...new Set(conversationIds)];
    if (unique.length === 0) return new Set();
    const rows = await this.prisma.conversation.findMany({
      where: { id: { in: unique }, organizationId },
      select: { id: true },
    });
    return new Set(rows.map((r) => r.id));
  }
}
