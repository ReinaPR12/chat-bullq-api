import { Injectable, NotFoundException } from '@nestjs/common';
import { ChatbotFlowsService } from '../../chatbot/chatbot-flows/chatbot-flows.service';
import {
  NodeExecutor,
  NodeExecutionContext,
} from '../../chatbot/engine/node-executors/node-executor.interface';
import { MessageNodeExecutor } from '../../chatbot/engine/node-executors/message-node.executor';
import { MenuNodeExecutor } from '../../chatbot/engine/node-executors/menu-node.executor';
import { ConditionNodeExecutor } from '../../chatbot/engine/node-executors/condition-node.executor';
import { WaitNodeExecutor } from '../../chatbot/engine/node-executors/wait-node.executor';
import { TransferNodeExecutor } from '../../chatbot/engine/node-executors/transfer-node.executor';
import { ChatbotSession } from '../../chatbot/session/chatbot-session.types';
import {
  PublicChatbotNodeDto,
  PublicCreateChatbotFlowDto,
  PublicSimulateChatbotDto,
  PublicUpdateChatbotFlowDto,
} from '../dto/public-chatbot.dto';

export interface PublicChatbotCaller {
  organizationId: string;
}

export interface PublicSimulateResult {
  messages: { type: string; content: Record<string, any> }[];
  /** Convenience alias: the next node(s) the run is parked on (empty when ended). */
  nextNodes: { id: string; type: string; name?: string | null }[];
  sessionState: Record<string, any> | null;
  ended: boolean;
  transferToHuman: boolean;
  transferDepartmentId?: string;
}

/**
 * Thin Public-API wrapper over the internal chatbot module. CRUD delegates to
 * ChatbotFlowsService, which already enforces org ownership (NotFound/Forbidden
 * for cross-org access). This layer only adapts ergonomics:
 *   - maps the public `status` field to the internal `isActive` boolean,
 *   - replaces nodes inline on create/update (edges live per-node),
 *   - normalizes DELETE to { ok, id },
 *   - exposes a stateless flow simulator that reuses the SAME node executors as
 *     the production engine, with an in-memory session (no Redis, no WhatsApp).
 */
@Injectable()
export class PublicChatbotService {
  private readonly executors: Map<string, NodeExecutor>;

  constructor(
    private readonly flows: ChatbotFlowsService,
    messageExec: MessageNodeExecutor,
    menuExec: MenuNodeExecutor,
    conditionExec: ConditionNodeExecutor,
    waitExec: WaitNodeExecutor,
    transferExec: TransferNodeExecutor,
  ) {
    this.executors = new Map<string, NodeExecutor>();
    this.executors.set(messageExec.nodeType, messageExec);
    this.executors.set(menuExec.nodeType, menuExec);
    this.executors.set(conditionExec.nodeType, conditionExec);
    this.executors.set(waitExec.nodeType, waitExec);
    this.executors.set(transferExec.nodeType, transferExec);
  }

  findAll(caller: PublicChatbotCaller) {
    return this.flows.findAll(caller.organizationId);
  }

  findOne(id: string, caller: PublicChatbotCaller) {
    return this.flows.findOne(id, caller.organizationId);
  }

  async create(dto: PublicCreateChatbotFlowDto, caller: PublicChatbotCaller) {
    const flow = await this.flows.create(caller.organizationId, {
      name: dto.name,
      description: dto.description,
      triggerType: dto.triggerType,
      triggerConfig: dto.triggerConfig,
    });
    if (dto.nodes) {
      await this.flows.saveNodes(
        flow.id,
        caller.organizationId,
        this.toNodes(dto.nodes),
      );
    }
    return this.flows.findOne(flow.id, caller.organizationId);
  }

  async update(
    id: string,
    dto: PublicUpdateChatbotFlowDto,
    caller: PublicChatbotCaller,
  ) {
    // findOne enforces org ownership before any mutation.
    await this.flows.findOne(id, caller.organizationId);

    const { nodes, edges: _edges, status, ...rest } = dto;
    const patch: Record<string, any> = { ...rest };
    if (status !== undefined) patch.isActive = status.toUpperCase() === 'ACTIVE';

    if (Object.keys(patch).length > 0) {
      await this.flows.update(id, caller.organizationId, patch);
    }
    if (nodes) {
      await this.flows.saveNodes(
        id,
        caller.organizationId,
        this.toNodes(nodes),
      );
    }
    return this.flows.findOne(id, caller.organizationId);
  }

  async remove(id: string, caller: PublicChatbotCaller) {
    await this.flows.remove(id, caller.organizationId);
    return { ok: true, id };
  }

  /**
   * Publishes (activates) a flow. The internal model has no version table, so
   * "publish" sets isActive=true so the engine starts routing matching
   * channels to it.
   */
  async publish(id: string, caller: PublicChatbotCaller) {
    await this.flows.update(id, caller.organizationId, { isActive: true });
    return this.flows.findOne(id, caller.organizationId);
  }

  /**
   * Stateless simulator. Loads the org-scoped flow (NotFound for cross-org),
   * then runs the same executor loop the production engine uses, holding the
   * session entirely in the request/response so callers can drive a multi-turn
   * conversation without Redis or a real channel.
   */
  async simulate(
    id: string,
    dto: PublicSimulateChatbotDto,
    caller: PublicChatbotCaller,
  ): Promise<PublicSimulateResult> {
    const flow: any = await this.flows.findOne(id, caller.organizationId);
    const nodes: any[] = flow.nodes ?? [];
    if (nodes.length === 0) {
      throw new NotFoundException('Flow has no nodes to simulate');
    }

    const session = this.resumeOrStartSession(dto.sessionState, flow.id, nodes);
    const nodesMap = new Map<string, any>(nodes.map((n) => [n.id, n]));

    const allMessages: PublicSimulateResult['messages'] = [];
    let transferToHuman = false;
    let transferDepartmentId: string | undefined;
    let currentNodeId: string | null = session.currentNodeId;
    let iterations = 0;
    const MAX_ITERATIONS = 20;

    while (currentNodeId && iterations < MAX_ITERATIONS) {
      iterations++;
      const node = nodesMap.get(currentNodeId);
      if (!node) break;

      if (node.type === 'END_FLOW') {
        return this.ended(allMessages, transferToHuman, transferDepartmentId);
      }

      const executor = this.executors.get(node.type);
      if (!executor) break;

      const ctx: NodeExecutionContext = {
        session,
        nodeData: (node.data as Record<string, any>) ?? {},
        nodeEdges: (node.edges as any[]) ?? [],
        incomingMessage: session.waitingForInput ? dto.input : undefined,
        conversationId: session.conversationId,
        channelId: 'simulate',
        contactExternalId: 'simulate',
      };

      const result = await executor.execute(ctx);
      allMessages.push(...result.sendMessages);

      if (result.updatedVariables) {
        Object.assign(session.variables, result.updatedVariables);
      }

      if (result.transferToHuman) {
        transferToHuman = true;
        transferDepartmentId = result.transferDepartmentId;
        return this.ended(allMessages, transferToHuman, transferDepartmentId);
      }

      if (result.waitForInput) {
        session.currentNodeId = currentNodeId;
        session.waitingForInput = true;
        return {
          messages: allMessages,
          nextNodes: [this.nodeSummary(node)],
          sessionState: this.serialize(session),
          ended: false,
          transferToHuman: false,
        };
      }

      currentNodeId = result.nextNodeId;
      session.waitingForInput = false;
      if (currentNodeId) session.currentNodeId = currentNodeId;
    }

    return this.ended(allMessages, transferToHuman, transferDepartmentId);
  }

  private resumeOrStartSession(
    state: Record<string, any> | undefined,
    flowId: string,
    nodes: any[],
  ): ChatbotSession {
    if (state && typeof state.currentNodeId === 'string') {
      return {
        flowId,
        conversationId: state.conversationId ?? 'simulate',
        currentNodeId: state.currentNodeId,
        variables: state.variables ?? {},
        waitingForInput: state.waitingForInput ?? false,
        startedAt: state.startedAt ?? new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
      };
    }

    const startNode = nodes.find((n) => n.type === 'START') ?? nodes[0];
    let currentNodeId = startNode.id;
    // Mirror the engine: a START node immediately advances to its first edge.
    if (startNode.type === 'START') {
      const edges = (startNode.edges as any[]) ?? [];
      if (edges[0]?.targetNodeId) currentNodeId = edges[0].targetNodeId;
    }
    return {
      flowId,
      conversationId: 'simulate',
      currentNodeId,
      variables: {},
      waitingForInput: false,
      startedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
    };
  }

  private ended(
    messages: PublicSimulateResult['messages'],
    transferToHuman: boolean,
    transferDepartmentId?: string,
  ): PublicSimulateResult {
    return {
      messages,
      nextNodes: [],
      sessionState: null,
      ended: true,
      transferToHuman,
      ...(transferDepartmentId ? { transferDepartmentId } : {}),
    };
  }

  private serialize(session: ChatbotSession): Record<string, any> {
    return {
      flowId: session.flowId,
      conversationId: session.conversationId,
      currentNodeId: session.currentNodeId,
      variables: session.variables,
      waitingForInput: session.waitingForInput,
      startedAt: session.startedAt,
      lastActivityAt: session.lastActivityAt,
    };
  }

  private nodeSummary(node: any) {
    return { id: node.id, type: node.type, name: node.name ?? null };
  }

  private toNodes(nodes: PublicChatbotNodeDto[]) {
    return nodes.map((n) => ({
      type: n.type,
      name: n.name,
      positionX: n.positionX ?? 0,
      positionY: n.positionY ?? 0,
      data: n.data ?? {},
      edges: n.edges ?? [],
    }));
  }
}
