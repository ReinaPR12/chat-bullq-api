import { NotFoundException } from '@nestjs/common';
import { PublicAiAgentsService } from './public-ai-agents.service';
import type { PublicAiAgentsCaller } from './public-ai-agents.service';

/**
 * Pins the multi-tenant contract of the Public AI-Agents API. Internal
 * services are fully mocked. Two classes of guarantee are tested:
 *
 *  1. Pass-through scoping — agent CRUD, catalog, runs and AI toggles all
 *     delegate to the internal services scoped to the API-key org, and
 *     cross-org NotFound propagates unchanged.
 *
 *  2. Pending-action ownership — pending actions have no org column, so this
 *     layer resolves the parent conversation's org and (a) drops foreign
 *     actions from the list, (b) refuses confirm/reject of foreign actions
 *     with NotFound (indistinguishable from "does not exist").
 */
describe('PublicAiAgentsService', () => {
  let agents: jest.Mocked<any>;
  let skills: jest.Mocked<any>;
  let tools: jest.Mocked<any>;
  let pendingActions: jest.Mocked<any>;
  let conversations: jest.Mocked<any>;
  let prisma: { conversation: { findMany: jest.Mock } };
  let service: PublicAiAgentsService;

  const caller: PublicAiAgentsCaller = {
    organizationId: 'org-A',
    actorId: 'user-1',
  };

  beforeEach(() => {
    agents = {
      list: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      listSkills: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      listRuns: jest.fn(),
    };
    skills = { list: jest.fn() };
    tools = { list: jest.fn() };
    pendingActions = {
      listByStatus: jest.fn(),
      get: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
    };
    conversations = { toggleAi: jest.fn() };
    prisma = { conversation: { findMany: jest.fn() } };
    service = new PublicAiAgentsService(
      agents,
      skills,
      tools,
      pendingActions,
      conversations,
      prisma as any,
    );
  });

  // ─── agents CRUD ────────────────────────────────────────────────

  it('list: scopes to the key org', async () => {
    agents.list.mockResolvedValue([{ id: 'a1', parentAgentId: null }]);
    const res = await service.list(caller);
    expect(agents.list).toHaveBeenCalledWith('org-A');
    expect(res).toEqual([{ id: 'a1', parentAgentId: null }]);
  });

  it('create: scopes to the key org', async () => {
    agents.create.mockResolvedValue({ id: 'a1' });
    await service.create({ name: 'Vendas' } as any, caller);
    expect(agents.create).toHaveBeenCalledWith('org-A', { name: 'Vendas' });
  });

  it('findOne: merges agent + attached skills', async () => {
    agents.findOne.mockResolvedValue({ id: 'a1', name: 'Vendas' });
    agents.listSkills.mockResolvedValue([{ skillId: 's1' }]);
    const res = await service.findOne('a1', caller);
    expect(agents.findOne).toHaveBeenCalledWith('org-A', 'a1');
    expect(agents.listSkills).toHaveBeenCalledWith('org-A', 'a1');
    expect(res).toEqual({ id: 'a1', name: 'Vendas', skills: [{ skillId: 's1' }] });
  });

  it('findOne: denies cross-org (propagates NotFound)', async () => {
    agents.findOne.mockRejectedValue(new NotFoundException('Agent not found'));
    await expect(service.findOne('a-other', caller)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(agents.listSkills).not.toHaveBeenCalled();
  });

  it('update: scopes to the key org', async () => {
    agents.update.mockResolvedValue({ id: 'a1' });
    await service.update('a1', { name: 'Novo' } as any, caller);
    expect(agents.update).toHaveBeenCalledWith('org-A', 'a1', { name: 'Novo' });
  });

  it('remove: scopes to key org and returns { ok, id }', async () => {
    agents.softDelete.mockResolvedValue(undefined);
    const res = await service.remove('a1', caller);
    expect(agents.softDelete).toHaveBeenCalledWith('org-A', 'a1');
    expect(res).toEqual({ ok: true, id: 'a1' });
  });

  it('remove: does NOT swallow cross-org NotFound', async () => {
    agents.softDelete.mockRejectedValue(new NotFoundException('Agent not found'));
    await expect(service.remove('a-other', caller)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  // ─── catalog + runs ─────────────────────────────────────────────

  it('catalog: returns org-scoped skills + tools', async () => {
    skills.list.mockResolvedValue([{ id: 's1' }]);
    tools.list.mockResolvedValue([{ id: 't1' }]);
    const res = await service.catalog(caller);
    expect(skills.list).toHaveBeenCalledWith('org-A');
    expect(tools.list).toHaveBeenCalledWith('org-A');
    expect(res).toEqual({ skills: [{ id: 's1' }], tools: [{ id: 't1' }] });
  });

  it('runs: scopes to key org and forwards limit', async () => {
    agents.listRuns.mockResolvedValue([{ id: 'run1' }]);
    await service.runs('a1', 25, caller);
    expect(agents.listRuns).toHaveBeenCalledWith('org-A', 'a1', 25);
  });

  // ─── pending actions (ownership) ────────────────────────────────

  it('listPendingActions: keeps only actions whose conversation is in the org', async () => {
    pendingActions.listByStatus.mockResolvedValue([
      { id: 'p1', conversationId: 'c1', status: 'PENDING' },
      { id: 'p2', conversationId: 'c-foreign', status: 'PENDING' },
    ]);
    // only c1 belongs to org-A
    prisma.conversation.findMany.mockResolvedValue([{ id: 'c1' }]);

    const res = await service.listPendingActions(caller);
    expect(pendingActions.listByStatus).toHaveBeenCalledWith('PENDING');
    expect(prisma.conversation.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['c1', 'c-foreign'] }, organizationId: 'org-A' },
      select: { id: true },
    });
    expect(res).toEqual([
      { id: 'p1', conversationId: 'c1', status: 'PENDING' },
    ]);
  });

  it('listPendingActions: short-circuits when there are no pending actions', async () => {
    pendingActions.listByStatus.mockResolvedValue([]);
    const res = await service.listPendingActions(caller);
    expect(res).toEqual([]);
    expect(prisma.conversation.findMany).not.toHaveBeenCalled();
  });

  it('confirmPendingAction: approves when the conversation belongs to the org', async () => {
    pendingActions.get.mockResolvedValue({ id: 'p1', conversationId: 'c1' });
    prisma.conversation.findMany.mockResolvedValue([{ id: 'c1' }]);
    pendingActions.approve.mockResolvedValue({ id: 'p1', status: 'APPROVED' });

    const res = await service.confirmPendingAction('p1', caller);
    expect(pendingActions.approve).toHaveBeenCalledWith('p1', 'user-1');
    expect(res).toEqual({ id: 'p1', status: 'APPROVED' });
  });

  it('confirmPendingAction: denies cross-org action with NotFound (no approve)', async () => {
    pendingActions.get.mockResolvedValue({ id: 'p2', conversationId: 'c-foreign' });
    prisma.conversation.findMany.mockResolvedValue([]); // not in org-A

    await expect(
      service.confirmPendingAction('p2', caller),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(pendingActions.approve).not.toHaveBeenCalled();
  });

  it('confirmPendingAction: NotFound when action does not exist', async () => {
    pendingActions.get.mockResolvedValue(null);
    await expect(
      service.confirmPendingAction('ghost', caller),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.conversation.findMany).not.toHaveBeenCalled();
    expect(pendingActions.approve).not.toHaveBeenCalled();
  });

  it('rejectPendingAction: rejects when owned and forwards reason + actor', async () => {
    pendingActions.get.mockResolvedValue({ id: 'p1', conversationId: 'c1' });
    prisma.conversation.findMany.mockResolvedValue([{ id: 'c1' }]);
    pendingActions.reject.mockResolvedValue({ id: 'p1', status: 'REJECTED' });

    await service.rejectPendingAction('p1', 'não autorizado', caller);
    expect(pendingActions.reject).toHaveBeenCalledWith(
      'p1',
      'user-1',
      'não autorizado',
    );
  });

  it('rejectPendingAction: denies cross-org action with NotFound (no reject)', async () => {
    pendingActions.get.mockResolvedValue({ id: 'p2', conversationId: 'c-foreign' });
    prisma.conversation.findMany.mockResolvedValue([]);

    await expect(
      service.rejectPendingAction('p2', 'x', caller),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(pendingActions.reject).not.toHaveBeenCalled();
  });

  // ─── AI toggle ──────────────────────────────────────────────────

  it('enableAi: forces AI on for the conversation scoped to the org', async () => {
    conversations.toggleAi.mockResolvedValue({ id: 'c1', aiEnabled: true });
    await service.enableAi('c1', caller);
    expect(conversations.toggleAi).toHaveBeenCalledWith(
      'c1',
      'org-A',
      true,
      'user-1',
    );
  });

  it('disableAi: forces AI off for the conversation scoped to the org', async () => {
    conversations.toggleAi.mockResolvedValue({ id: 'c1', aiEnabled: false });
    await service.disableAi('c1', caller);
    expect(conversations.toggleAi).toHaveBeenCalledWith(
      'c1',
      'org-A',
      false,
      'user-1',
    );
  });

  it('disableAi: denies cross-org conversation (propagates NotFound)', async () => {
    conversations.toggleAi.mockRejectedValue(
      new NotFoundException('Conversation not found'),
    );
    await expect(service.disableAi('c-foreign', caller)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
