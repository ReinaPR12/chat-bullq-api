import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { PublicChatbotService } from './public-chatbot.service';
import type { PublicChatbotCaller } from './public-chatbot.service';
import { MessageNodeExecutor } from '../../chatbot/engine/node-executors/message-node.executor';
import { MenuNodeExecutor } from '../../chatbot/engine/node-executors/menu-node.executor';
import { ConditionNodeExecutor } from '../../chatbot/engine/node-executors/condition-node.executor';
import { WaitNodeExecutor } from '../../chatbot/engine/node-executors/wait-node.executor';
import { TransferNodeExecutor } from '../../chatbot/engine/node-executors/transfer-node.executor';

/**
 * Pins the multi-tenant contract of the Public Chatbot API. CRUD delegates to
 * the internal ChatbotFlowsService scoped to the org inferred from the API key;
 * cross-org access (NotFound/Forbidden) propagates unchanged. The simulator
 * reuses the REAL node executors (pure, no IO) over an in-memory session, so it
 * is exercised end-to-end without Redis or WhatsApp. ChatbotFlowsService is
 * fully mocked.
 */
describe('PublicChatbotService', () => {
  let flows: jest.Mocked<any>;
  let service: PublicChatbotService;

  const caller: PublicChatbotCaller = { organizationId: 'org-A' };

  beforeEach(() => {
    flows = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      saveNodes: jest.fn(),
    };
    service = new PublicChatbotService(
      flows,
      new MessageNodeExecutor(),
      new MenuNodeExecutor(),
      new ConditionNodeExecutor(),
      new WaitNodeExecutor(),
      new TransferNodeExecutor(),
    );
  });

  // ─── CRUD scoping ──────────────────────────────────────────────

  it('findAll: lists only the key org flows', async () => {
    flows.findAll.mockResolvedValue([{ id: 'f1', name: 'Flow' }]);
    const res = await service.findAll(caller);
    expect(flows.findAll).toHaveBeenCalledWith('org-A');
    expect(res).toEqual([{ id: 'f1', name: 'Flow' }]);
  });

  it('findOne: scopes to the key org', async () => {
    flows.findOne.mockResolvedValue({ id: 'f1', nodes: [] });
    await service.findOne('f1', caller);
    expect(flows.findOne).toHaveBeenCalledWith('f1', 'org-A');
  });

  it('findOne: denies cross-org (propagates ForbiddenException)', async () => {
    flows.findOne.mockRejectedValue(new ForbiddenException());
    await expect(service.findOne('f-other', caller)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('create: scopes to key org and returns the reloaded flow', async () => {
    flows.create.mockResolvedValue({ id: 'f1' });
    flows.findOne.mockResolvedValue({ id: 'f1', nodes: [] });
    const res = await service.create({ name: 'Flow' }, caller);
    expect(flows.create).toHaveBeenCalledWith('org-A', {
      name: 'Flow',
      description: undefined,
      triggerType: undefined,
      triggerConfig: undefined,
    });
    expect(res).toEqual({ id: 'f1', nodes: [] });
  });

  it('create: persists provided nodes via saveNodes (defaults applied)', async () => {
    flows.create.mockResolvedValue({ id: 'f1' });
    flows.findOne.mockResolvedValue({ id: 'f1' });
    await service.create(
      {
        name: 'Flow',
        nodes: [
          { type: 'MESSAGE', data: { message: 'hi' }, edges: [] } as any,
        ],
      },
      caller,
    );
    expect(flows.saveNodes).toHaveBeenCalledWith('f1', 'org-A', [
      {
        type: 'MESSAGE',
        name: undefined,
        positionX: 0,
        positionY: 0,
        data: { message: 'hi' },
        edges: [],
      },
    ]);
  });

  it('update: maps status="ACTIVE" to isActive=true', async () => {
    flows.findOne.mockResolvedValue({ id: 'f1' });
    flows.update.mockResolvedValue({ id: 'f1' });
    await service.update('f1', { status: 'ACTIVE' }, caller);
    expect(flows.update).toHaveBeenCalledWith('f1', 'org-A', {
      isActive: true,
    });
  });

  it('update: maps status="DRAFT" to isActive=false', async () => {
    flows.findOne.mockResolvedValue({ id: 'f1' });
    flows.update.mockResolvedValue({ id: 'f1' });
    await service.update('f1', { status: 'DRAFT' }, caller);
    expect(flows.update).toHaveBeenCalledWith('f1', 'org-A', {
      isActive: false,
    });
  });

  it('update: replaces nodes when provided', async () => {
    flows.findOne.mockResolvedValue({ id: 'f1' });
    await service.update(
      'f1',
      { nodes: [{ type: 'END_FLOW', data: {}, edges: [] } as any] },
      caller,
    );
    expect(flows.saveNodes).toHaveBeenCalledWith('f1', 'org-A', [
      {
        type: 'END_FLOW',
        name: undefined,
        positionX: 0,
        positionY: 0,
        data: {},
        edges: [],
      },
    ]);
  });

  it('update: denies cross-org before mutating (propagates NotFound)', async () => {
    flows.findOne.mockRejectedValue(new NotFoundException());
    await expect(
      service.update('f-other', { name: 'X' }, caller),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(flows.update).not.toHaveBeenCalled();
    expect(flows.saveNodes).not.toHaveBeenCalled();
  });

  it('remove: scopes to key org and returns { ok, id }', async () => {
    flows.remove.mockResolvedValue(undefined);
    const res = await service.remove('f1', caller);
    expect(flows.remove).toHaveBeenCalledWith('f1', 'org-A');
    expect(res).toEqual({ ok: true, id: 'f1' });
  });

  it('remove: does NOT swallow cross-org NotFound', async () => {
    flows.remove.mockRejectedValue(new NotFoundException());
    await expect(service.remove('f-other', caller)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('publish: activates the flow (isActive=true) org-scoped', async () => {
    flows.update.mockResolvedValue({ id: 'f1' });
    flows.findOne.mockResolvedValue({ id: 'f1', isActive: true });
    const res = await service.publish('f1', caller);
    expect(flows.update).toHaveBeenCalledWith('f1', 'org-A', {
      isActive: true,
    });
    expect(res).toEqual({ id: 'f1', isActive: true });
  });

  // ─── Simulator ─────────────────────────────────────────────────

  it('simulate: cross-org flow is denied (propagates NotFound from findOne)', async () => {
    flows.findOne.mockRejectedValue(new NotFoundException());
    await expect(
      service.simulate('f-other', { input: 'hi' }, caller),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('simulate: empty flow throws NotFound', async () => {
    flows.findOne.mockResolvedValue({ id: 'f1', nodes: [] });
    await expect(service.simulate('f1', {}, caller)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('simulate: runs MESSAGE -> END_FLOW from START and ends', async () => {
    flows.findOne.mockResolvedValue({
      id: 'f1',
      nodes: [
        { id: 's', type: 'START', edges: [{ targetNodeId: 'm' }] },
        {
          id: 'm',
          type: 'MESSAGE',
          data: { message: 'Olá {{name}}' },
          edges: [{ targetNodeId: 'end' }],
        },
        { id: 'end', type: 'END_FLOW', data: {}, edges: [] },
      ],
    });

    const res = await service.simulate('f1', {}, caller);

    expect(res.ended).toBe(true);
    expect(res.sessionState).toBeNull();
    expect(res.nextNodes).toEqual([]);
    expect(res.messages).toEqual([
      { type: 'TEXT', content: { text: 'Olá {{name}}' } },
    ]);
  });

  it('simulate: WAIT parks the run and returns resumable sessionState', async () => {
    flows.findOne.mockResolvedValue({
      id: 'f1',
      nodes: [
        {
          id: 'w',
          type: 'WAIT',
          name: 'Ask name',
          data: { prompt: 'Qual seu nome?', saveAs: 'name' },
          edges: [{ targetNodeId: 'm' }],
        },
        {
          id: 'm',
          type: 'MESSAGE',
          data: { message: 'Oi {{name}}' },
          edges: [{ targetNodeId: 'end' }],
        },
        { id: 'end', type: 'END_FLOW', data: {}, edges: [] },
      ],
    });

    const first = await service.simulate('f1', {}, caller);
    expect(first.ended).toBe(false);
    expect(first.messages).toEqual([
      { type: 'TEXT', content: { text: 'Qual seu nome?' } },
    ]);
    expect(first.nextNodes).toEqual([{ id: 'w', type: 'WAIT', name: 'Ask name' }]);
    expect(first.sessionState?.currentNodeId).toBe('w');
    expect(first.sessionState?.waitingForInput).toBe(true);

    // Resume with the user's answer; WAIT saves it and flows to MESSAGE.
    const second = await service.simulate(
      'f1',
      { input: 'Pietro', sessionState: first.sessionState! },
      caller,
    );
    expect(second.ended).toBe(true);
    expect(second.messages).toEqual([
      { type: 'TEXT', content: { text: 'Oi Pietro' } },
    ]);
  });

  it('simulate: TRANSFER ends with transferToHuman + department', async () => {
    flows.findOne.mockResolvedValue({
      id: 'f1',
      nodes: [
        {
          id: 't',
          type: 'TRANSFER',
          data: { message: 'Aguarde', departmentId: 'dep-1' },
          edges: [],
        },
      ],
    });

    const res = await service.simulate('f1', {}, caller);
    expect(res.ended).toBe(true);
    expect(res.transferToHuman).toBe(true);
    expect(res.transferDepartmentId).toBe('dep-1');
    expect(res.messages).toEqual([
      { type: 'TEXT', content: { text: 'Aguarde' } },
    ]);
  });

  it('simulate: MENU routes by edge condition matching the selected value', async () => {
    flows.findOne.mockResolvedValue({
      id: 'f1',
      nodes: [
        {
          id: 'menu',
          type: 'MENU',
          data: {
            title: 'Escolha',
            options: [
              { label: 'Vendas', value: 'sales' },
              { label: 'Suporte', value: 'support' },
            ],
          },
          edges: [
            { targetNodeId: 'sales-msg', condition: 'sales' },
            { targetNodeId: 'support-msg', condition: 'support' },
          ],
        },
        {
          id: 'support-msg',
          type: 'MESSAGE',
          data: { message: 'Suporte aqui' },
          edges: [{ targetNodeId: 'end' }],
        },
        { id: 'end', type: 'END_FLOW', data: {}, edges: [] },
      ],
    });

    const first = await service.simulate('f1', {}, caller);
    expect(first.ended).toBe(false);
    expect(first.sessionState?.currentNodeId).toBe('menu');

    // Pick option 2 (Suporte) -> support-msg -> end.
    const second = await service.simulate(
      'f1',
      { input: '2', sessionState: first.sessionState! },
      caller,
    );
    expect(second.ended).toBe(true);
    expect(second.messages).toEqual([
      { type: 'TEXT', content: { text: 'Suporte aqui' } },
    ]);
  });
});
