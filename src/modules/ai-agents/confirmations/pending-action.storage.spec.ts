import { PendingActionStorage } from './pending-action.storage';

/**
 * Pins the data-layer tenant isolation for ai_pending_actions (Bug #3).
 *
 * Prisma is fully mocked; these tests assert that when an organizationId is
 * supplied every read is scoped to that tenant — a cross-org id resolves to
 * `null` (findFirst with the org filter) instead of leaking via findUnique.
 */
describe('PendingActionStorage (org isolation)', () => {
  let prisma: {
    aiPendingAction: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
    };
  };
  let storage: PendingActionStorage;

  const row = {
    id: 'p1',
    organizationId: 'org-A',
    agentRunId: 'run1',
    conversationId: 'c1',
    agentId: 'a1',
    toolName: 'transfer_to_human',
    args: {},
    preview: { action: 'x', impact: 'critical', affectedEntity: {} },
    status: 'PENDING',
    decidedBy: null,
    decidedAt: null,
    rejectionReason: null,
    executionResult: null,
    expiresAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = {
      aiPendingAction: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };
    storage = new PendingActionStorage(prisma as any);
  });

  describe('get', () => {
    it('scopes by org via findFirst when organizationId is supplied', async () => {
      prisma.aiPendingAction.findFirst.mockResolvedValue(row);
      const res = await storage.get('p1', 'org-A');
      expect(prisma.aiPendingAction.findFirst).toHaveBeenCalledWith({
        where: { id: 'p1', organizationId: 'org-A' },
      });
      expect(prisma.aiPendingAction.findUnique).not.toHaveBeenCalled();
      expect(res?.id).toBe('p1');
      expect(res?.organizationId).toBe('org-A');
    });

    it('returns null for a cross-org id (findFirst misses)', async () => {
      prisma.aiPendingAction.findFirst.mockResolvedValue(null);
      const res = await storage.get('p1', 'org-OTHER');
      expect(res).toBeNull();
    });

    it('falls back to findUnique when no org is supplied (internal path)', async () => {
      prisma.aiPendingAction.findUnique.mockResolvedValue(row);
      await storage.get('p1');
      expect(prisma.aiPendingAction.findUnique).toHaveBeenCalledWith({
        where: { id: 'p1' },
      });
      expect(prisma.aiPendingAction.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('listByStatus', () => {
    it('adds organizationId to the where clause when supplied', async () => {
      prisma.aiPendingAction.findMany.mockResolvedValue([row]);
      await storage.listByStatus('PENDING', undefined, 'org-A');
      expect(prisma.aiPendingAction.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING', organizationId: 'org-A' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('combines conversationId + organizationId filters', async () => {
      prisma.aiPendingAction.findMany.mockResolvedValue([]);
      await storage.listByStatus('PENDING', 'c1', 'org-A');
      expect(prisma.aiPendingAction.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING', conversationId: 'c1', organizationId: 'org-A' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('omits org filter when not supplied (internal path)', async () => {
      prisma.aiPendingAction.findMany.mockResolvedValue([]);
      await storage.listByStatus('PENDING');
      expect(prisma.aiPendingAction.findMany).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('listByConversation', () => {
    it('adds organizationId to the where clause when supplied', async () => {
      prisma.aiPendingAction.findMany.mockResolvedValue([row]);
      await storage.listByConversation('c1', 'org-A');
      expect(prisma.aiPendingAction.findMany).toHaveBeenCalledWith({
        where: { conversationId: 'c1', organizationId: 'org-A' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
