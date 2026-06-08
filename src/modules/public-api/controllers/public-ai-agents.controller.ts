import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyAuthGuard } from '../../../common/guards';
import { CurrentOrg, CurrentUser } from '../../../common/decorators';
import { CreateAgentDto } from '../../ai-agents/agents/dto/create-agent.dto';
import { UpdateAgentDto } from '../../ai-agents/agents/dto/update-agent.dto';
import { PublicRejectPendingActionDto } from '../dto/public-ai-agent.dto';
import {
  PublicAiAgentsService,
  type PublicAiAgentsCaller,
} from '../services/public-ai-agents.service';

type PublicOrg = { id: string };
type PublicUser = { id: string };

/**
 * Public API for the AI-Agents stack (Jarvis panel + organograma + pending
 * actions). All routes are org-scoped via the API key. Responses are wrapped
 * by the global ResponseInterceptor into { data, meta }.
 *
 * Route ordering note: the static `catalog` and `pending-actions` segments are
 * declared before the dynamic `:id` routes so Nest doesn't capture them as an
 * agent id.
 */
@ApiTags('Public API · AI Agents')
@ApiSecurity('api-key')
@UseGuards(ApiKeyAuthGuard)
@Controller('public/ai-agents')
export class PublicAiAgentsController {
  constructor(private readonly service: PublicAiAgentsService) {}

  private caller(org: PublicOrg, user: PublicUser): PublicAiAgentsCaller {
    return { organizationId: org.id, actorId: user.id };
  }

  // ─── static routes first ────────────────────────────────────────

  @Get('catalog')
  @ApiOperation({
    summary:
      'Skills + tools disponíveis na org (catálogo para montar/atribuir capacidades).',
  })
  catalog(@CurrentOrg() org: PublicOrg, @CurrentUser() user: PublicUser) {
    return this.service.catalog(this.caller(org, user));
  }

  @Get('pending-actions')
  @ApiOperation({
    summary:
      'Ações pendentes de confirmação humana (status PENDING) das conversas da org.',
  })
  listPendingActions(
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
  ) {
    return this.service.listPendingActions(this.caller(org, user));
  }

  @Post('pending-actions/:id/confirm')
  @ApiOperation({ summary: 'Confirma (aprova) uma ação pendente — dispara execução.' })
  confirmPendingAction(
    @Param('id') id: string,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
  ) {
    return this.service.confirmPendingAction(id, this.caller(org, user));
  }

  @Post('pending-actions/:id/reject')
  @ApiOperation({ summary: 'Rejeita uma ação pendente (motivo obrigatório).' })
  rejectPendingAction(
    @Param('id') id: string,
    @Body() dto: PublicRejectPendingActionDto,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
  ) {
    return this.service.rejectPendingAction(
      id,
      dto?.reason ?? '',
      this.caller(org, user),
    );
  }

  // ─── agents CRUD ─────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary:
      'Lista agentes da org (inclui parentAgentId para montar o organograma).',
  })
  list(@CurrentOrg() org: PublicOrg, @CurrentUser() user: PublicUser) {
    return this.service.list(this.caller(org, user));
  }

  @Post()
  @ApiOperation({ summary: 'Cria um agente (org-scoped).' })
  create(
    @Body() dto: CreateAgentDto,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
  ) {
    return this.service.create(dto, this.caller(org, user));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalhe do agente + skills atribuídas.' })
  findOne(
    @Param('id') id: string,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
  ) {
    return this.service.findOne(id, this.caller(org, user));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um agente (org-scoped).' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAgentDto,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
  ) {
    return this.service.update(id, dto, this.caller(org, user));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete de um agente (org-scoped).' })
  remove(
    @Param('id') id: string,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
  ) {
    return this.service.remove(id, this.caller(org, user));
  }

  @Get(':id/runs')
  @ApiOperation({
    summary: 'Execuções recentes do agente (observabilidade Jarvis).',
  })
  runs(
    @Param('id') id: string,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Math.min(parseInt(limit, 10) || 50, 200) : 50;
    return this.service.runs(id, parsed, this.caller(org, user));
  }
}
