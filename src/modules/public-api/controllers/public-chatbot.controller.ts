import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyAuthGuard } from '../../../common/guards';
import { CurrentOrg } from '../../../common/decorators';
import {
  PublicCreateChatbotFlowDto,
  PublicSimulateChatbotDto,
  PublicUpdateChatbotFlowDto,
} from '../dto/public-chatbot.dto';
import {
  PublicChatbotService,
  type PublicChatbotCaller,
} from '../services/public-chatbot.service';

type PublicOrg = { id: string };

@ApiTags('Public API · Chatbot')
@ApiSecurity('api-key')
@UseGuards(ApiKeyAuthGuard)
@Controller('public/chatbot')
export class PublicChatbotController {
  constructor(private readonly service: PublicChatbotService) {}

  private caller(org: PublicOrg): PublicChatbotCaller {
    return { organizationId: org.id };
  }

  @Get('flows')
  @ApiOperation({ summary: 'List chatbot flows for the API key organization.' })
  findAll(@CurrentOrg() org: PublicOrg) {
    return this.service.findAll(this.caller(org));
  }

  @Post('flows')
  @ApiOperation({ summary: 'Create a chatbot flow (optionally with nodes).' })
  create(
    @Body() dto: PublicCreateChatbotFlowDto,
    @CurrentOrg() org: PublicOrg,
  ) {
    return this.service.create(dto, this.caller(org));
  }

  @Get('flows/:id')
  @ApiOperation({ summary: 'Get a chatbot flow with its nodes (org-scoped).' })
  findOne(@Param('id') id: string, @CurrentOrg() org: PublicOrg) {
    return this.service.findOne(id, this.caller(org));
  }

  @Patch('flows/:id')
  @ApiOperation({ summary: 'Update a chatbot flow (name/nodes/status) — org-scoped.' })
  update(
    @Param('id') id: string,
    @Body() dto: PublicUpdateChatbotFlowDto,
    @CurrentOrg() org: PublicOrg,
  ) {
    return this.service.update(id, dto, this.caller(org));
  }

  @Delete('flows/:id')
  @ApiOperation({ summary: 'Soft-delete a chatbot flow (org-scoped).' })
  remove(@Param('id') id: string, @CurrentOrg() org: PublicOrg) {
    return this.service.remove(id, this.caller(org));
  }

  @Post('flows/:id/publish')
  @ApiOperation({ summary: 'Publish/activate a chatbot flow (org-scoped).' })
  publish(@Param('id') id: string, @CurrentOrg() org: PublicOrg) {
    return this.service.publish(id, this.caller(org));
  }

  @Post('flows/:id/simulate')
  @ApiOperation({
    summary:
      'Simulate a flow run without WhatsApp. Feed { input, sessionState? }; returns { messages, nextNodes, sessionState, ended }.',
  })
  simulate(
    @Param('id') id: string,
    @Body() dto: PublicSimulateChatbotDto,
    @CurrentOrg() org: PublicOrg,
  ) {
    return this.service.simulate(id, dto, this.caller(org));
  }
}
