import { PublicAiAgentsController } from './public-ai-agents.controller';

/**
 * Verifies the controller wires API-key org + user into the caller and
 * forwards params/body to the service. The service is fully mocked; the
 * envelope ({ data, meta }) is added by the global ResponseInterceptor and is
 * out of scope here.
 */
describe('PublicAiAgentsController', () => {
  let service: jest.Mocked<any>;
  let controller: PublicAiAgentsController;

  const org = { id: 'org-A' };
  const user = { id: 'user-1' };
  const caller = { organizationId: 'org-A', actorId: 'user-1' };

  beforeEach(() => {
    service = {
      list: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      runs: jest.fn(),
      catalog: jest.fn(),
      listPendingActions: jest.fn(),
      confirmPendingAction: jest.fn(),
      rejectPendingAction: jest.fn(),
    };
    controller = new PublicAiAgentsController(service);
  });

  it('list: forwards the caller', () => {
    controller.list(org, user);
    expect(service.list).toHaveBeenCalledWith(caller);
  });

  it('create: forwards dto + caller', () => {
    const dto = { name: 'Vendas' } as any;
    controller.create(dto, org, user);
    expect(service.create).toHaveBeenCalledWith(dto, caller);
  });

  it('findOne: forwards id + caller', () => {
    controller.findOne('a1', org, user);
    expect(service.findOne).toHaveBeenCalledWith('a1', caller);
  });

  it('update: forwards id + dto + caller', () => {
    const dto = { name: 'Novo' } as any;
    controller.update('a1', dto, org, user);
    expect(service.update).toHaveBeenCalledWith('a1', dto, caller);
  });

  it('remove: forwards id + caller', () => {
    controller.remove('a1', org, user);
    expect(service.remove).toHaveBeenCalledWith('a1', caller);
  });

  it('runs: clamps limit and forwards caller', () => {
    controller.runs('a1', org, user, '500');
    expect(service.runs).toHaveBeenCalledWith('a1', 200, caller);
  });

  it('runs: defaults limit to 50 when absent', () => {
    controller.runs('a1', org, user, undefined);
    expect(service.runs).toHaveBeenCalledWith('a1', 50, caller);
  });

  it('catalog: forwards the caller', () => {
    controller.catalog(org, user);
    expect(service.catalog).toHaveBeenCalledWith(caller);
  });

  it('listPendingActions: forwards the caller', () => {
    controller.listPendingActions(org, user);
    expect(service.listPendingActions).toHaveBeenCalledWith(caller);
  });

  it('confirmPendingAction: forwards id + caller', () => {
    controller.confirmPendingAction('p1', org, user);
    expect(service.confirmPendingAction).toHaveBeenCalledWith('p1', caller);
  });

  it('rejectPendingAction: forwards id + reason + caller', () => {
    controller.rejectPendingAction('p1', { reason: 'no' }, org, user);
    expect(service.rejectPendingAction).toHaveBeenCalledWith('p1', 'no', caller);
  });

  it('rejectPendingAction: passes empty string when reason missing', () => {
    controller.rejectPendingAction('p1', {} as any, org, user);
    expect(service.rejectPendingAction).toHaveBeenCalledWith('p1', '', caller);
  });
});
