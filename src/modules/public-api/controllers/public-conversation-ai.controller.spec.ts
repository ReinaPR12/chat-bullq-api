import { PublicConversationAiController } from './public-conversation-ai.controller';

describe('PublicConversationAiController', () => {
  let service: jest.Mocked<any>;
  let controller: PublicConversationAiController;

  const org = { id: 'org-A' };
  const user = { id: 'user-1' };
  const caller = { organizationId: 'org-A', actorId: 'user-1' };

  beforeEach(() => {
    service = { enableAi: jest.fn(), disableAi: jest.fn() };
    controller = new PublicConversationAiController(service);
  });

  it('enable: forwards conversationId + caller', () => {
    controller.enable('c1', org, user);
    expect(service.enableAi).toHaveBeenCalledWith('c1', caller);
  });

  it('disable: forwards conversationId + caller', () => {
    controller.disable('c1', org, user);
    expect(service.disableAi).toHaveBeenCalledWith('c1', caller);
  });
});
