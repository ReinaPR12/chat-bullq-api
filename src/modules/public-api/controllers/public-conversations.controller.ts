import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyAuthGuard } from '../../../common/guards';
import {
  CurrentChannelAccess,
  CurrentOrg,
  CurrentUser,
} from '../../../common/decorators';
import type { ChannelAccess } from '../../iam/channel-access/channel-access.service';
import { PublicUpdateConversationDto } from '../dto/public-conversation.dto';
import {
  PublicConversationsService,
  type PublicConversationsCaller,
} from '../services/public-conversations.service';

type PublicOrg = { id: string };
type PublicUser = { id: string };

@ApiTags('Public API · Conversations')
@ApiSecurity('api-key')
@UseGuards(ApiKeyAuthGuard)
@Controller('public/conversations')
export class PublicConversationsController {
  constructor(private readonly service: PublicConversationsService) {}

  private caller(
    org: PublicOrg,
    user: PublicUser,
    access: ChannelAccess,
  ): PublicConversationsCaller {
    return { organizationId: org.id, userId: user.id, access };
  }

  @Get()
  @ApiOperation({
    summary:
      'List conversations for the API key org (filters, paginated). Scoped to the key holder accessible channels.',
  })
  @ApiQuery({ name: 'channelId', required: false })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'CSV of ConversationStatus (e.g. OPEN,PENDING).',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'assignedTo', required: false })
  @ApiQuery({
    name: 'kind',
    required: false,
    description: 'INDIVIDUAL | GROUP. Omit for both.',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  list(
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
    @CurrentChannelAccess() access: ChannelAccess,
    @Query('channelId') channelId?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('kind') kind?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsedKind: 'INDIVIDUAL' | 'GROUP' | undefined =
      kind === 'INDIVIDUAL' || kind === 'GROUP' ? kind : undefined;
    return this.service.list(
      { channelId, status, search, assignedTo, kind: parsedKind },
      parseInt(page || '1', 10),
      parseInt(limit || '20', 10),
      this.caller(org, user, access),
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single conversation with its contact (org + channel scoped).',
  })
  get(
    @Param('id') id: string,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
    @CurrentChannelAccess() access: ChannelAccess,
  ) {
    return this.service.get(id, this.caller(org, user, access));
  }

  @Get(':id/messages')
  @ApiOperation({
    summary:
      'List messages of a conversation, oldest-first within the page (org + channel scoped).',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  messages(
    @Param('id') id: string,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
    @CurrentChannelAccess() access: ChannelAccess,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.messagesFor(
      id,
      parseInt(page || '1', 10),
      parseInt(limit || '30', 10),
      this.caller(org, user, access),
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary:
      'Update a conversation: change status, assignment, and/or per-user read state (unread).',
  })
  update(
    @Param('id') id: string,
    @Body() dto: PublicUpdateConversationDto,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
    @CurrentChannelAccess() access: ChannelAccess,
  ) {
    return this.service.update(id, dto, this.caller(org, user, access));
  }
}
