import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyAuthGuard } from '../../../common/guards';
import { CurrentOrg, CurrentUser } from '../../../common/decorators';
import {
  PublicAiAgentsService,
  type PublicAiAgentsCaller,
} from '../services/public-ai-agents.service';

type PublicOrg = { id: string };
type PublicUser = { id: string };

/**
 * Public API to toggle the AI on/off for a specific conversation (the per-chat
 * switch in the CRM). Both routes are org-scoped via the API key and delegate
 * to ConversationsService.toggleAi, which enforces ownership before mutating.
 */
@ApiTags('Public API · Conversation AI')
@ApiSecurity('api-key')
@UseGuards(ApiKeyAuthGuard)
@Controller('public/conversations')
export class PublicConversationAiController {
  constructor(private readonly service: PublicAiAgentsService) {}

  private caller(org: PublicOrg, user: PublicUser): PublicAiAgentsCaller {
    return { organizationId: org.id, actorId: user.id };
  }

  @Post(':conversationId/ai/enable')
  @ApiOperation({ summary: 'Ativa (força ON) a IA nesta conversa.' })
  enable(
    @Param('conversationId') conversationId: string,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
  ) {
    return this.service.enableAi(conversationId, this.caller(org, user));
  }

  @Post(':conversationId/ai/disable')
  @ApiOperation({ summary: 'Desativa (força OFF / kill switch) a IA nesta conversa.' })
  disable(
    @Param('conversationId') conversationId: string,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
  ) {
    return this.service.disableAi(conversationId, this.caller(org, user));
  }
}
