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
import {
  CurrentChannelAccess,
  CurrentOrg,
  CurrentUser,
} from '../../../common/decorators';
import type { ChannelAccess } from '../../iam/channel-access/channel-access.service';
import {
  PublicCreateInboxViewDto,
  PublicReorderInboxViewsDto,
  PublicUpdateInboxViewDto,
} from '../dto/public-inbox-view.dto';
import {
  PublicInboxViewsService,
  type PublicInboxViewsCaller,
} from '../services/public-inbox-views.service';

type PublicOrg = { id: string };
type PublicUser = { id: string };

@ApiTags('Public API · Inbox Views')
@ApiSecurity('api-key')
@UseGuards(ApiKeyAuthGuard)
@Controller('public/inbox-views')
export class PublicInboxViewsController {
  constructor(private readonly service: PublicInboxViewsService) {}

  private caller(
    org: PublicOrg,
    user: PublicUser,
    access: ChannelAccess,
  ): PublicInboxViewsCaller {
    return { organizationId: org.id, userId: user.id, access };
  }

  @Get()
  @ApiOperation({ summary: 'List inbox views for the API key holder.' })
  list(
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
    @CurrentChannelAccess() access: ChannelAccess,
  ) {
    return this.service.list(this.caller(org, user, access));
  }

  @Post()
  @ApiOperation({ summary: 'Create an inbox view for the API key holder.' })
  create(
    @Body() dto: PublicCreateInboxViewDto,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
    @CurrentChannelAccess() access: ChannelAccess,
  ) {
    return this.service.create(dto, this.caller(org, user, access));
  }

  // Declared before ':id' so "reorder" is not captured as an id param.
  @Patch('reorder')
  @ApiOperation({ summary: 'Reorder inbox views (drag-drop).' })
  reorder(
    @Body() dto: PublicReorderInboxViewsDto,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
    @CurrentChannelAccess() access: ChannelAccess,
  ) {
    return this.service.reorder(dto.orderedIds, this.caller(org, user, access));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an inbox view (org + holder scoped).' })
  update(
    @Param('id') id: string,
    @Body() dto: PublicUpdateInboxViewDto,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
    @CurrentChannelAccess() access: ChannelAccess,
  ) {
    return this.service.update(id, dto, this.caller(org, user, access));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an inbox view (org + holder scoped).' })
  remove(
    @Param('id') id: string,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
    @CurrentChannelAccess() access: ChannelAccess,
  ) {
    return this.service.remove(id, this.caller(org, user, access));
  }

  @Get(':id/conversations')
  @ApiOperation({
    summary: 'List conversations matching the inbox view filters.',
  })
  conversations(
    @Param('id') id: string,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
    @CurrentChannelAccess() access: ChannelAccess,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.service.conversations(
      id,
      this.caller(org, user, access),
      parseInt(page || '1', 10),
      parseInt(limit || '20', 10),
      search,
    );
  }
}
