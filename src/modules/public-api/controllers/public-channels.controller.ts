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
import { OrgRole } from '@prisma/client';
import { ApiKeyAuthGuard } from '../../../common/guards';
import { CurrentChannelAccess, CurrentOrg } from '../../../common/decorators';
import type { ChannelAccess } from '../../iam/channel-access/channel-access.service';
import { PublicCreateChannelDto } from '../dto/public-create-channel.dto';
import { PublicUpdateChannelDto } from '../dto/public-update-channel.dto';
import {
  PublicChannelsService,
  type PublicChannelCaller,
} from '../services/public-channels.service';

type PublicOrg = {
  id: string;
  userOrganizationId: string;
  userRole: OrgRole;
};

@ApiTags('Public API · Channels')
@ApiSecurity('api-key')
@UseGuards(ApiKeyAuthGuard)
@Controller('public/channels')
export class PublicChannelsController {
  constructor(private readonly service: PublicChannelsService) {}

  private caller(org: PublicOrg, access: ChannelAccess): PublicChannelCaller {
    return {
      organizationId: org.id,
      userOrganizationId: org.userOrganizationId,
      role: org.userRole,
      access,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a channel scoped to the API key organization.' })
  create(
    @Body() dto: PublicCreateChannelDto,
    @CurrentOrg() org: PublicOrg,
    @CurrentChannelAccess() access: ChannelAccess,
  ) {
    return this.service.create(dto, this.caller(org, access));
  }

  @Get()
  @ApiOperation({ summary: 'List channels for the API key organization.' })
  findAll(
    @CurrentOrg() org: PublicOrg,
    @CurrentChannelAccess() access: ChannelAccess,
  ) {
    return this.service.findAll(this.caller(org, access));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a channel by id (org-scoped).' })
  findOne(
    @Param('id') id: string,
    @CurrentOrg() org: PublicOrg,
    @CurrentChannelAccess() access: ChannelAccess,
  ) {
    return this.service.findOne(id, this.caller(org, access));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a channel (name, isActive, visibility, config).' })
  update(
    @Param('id') id: string,
    @Body() dto: PublicUpdateChannelDto,
    @CurrentOrg() org: PublicOrg,
    @CurrentChannelAccess() access: ChannelAccess,
  ) {
    return this.service.update(id, dto, this.caller(org, access));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a channel (org-scoped).' })
  remove(
    @Param('id') id: string,
    @CurrentOrg() org: PublicOrg,
    @CurrentChannelAccess() access: ChannelAccess,
  ) {
    return this.service.remove(id, this.caller(org, access));
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test the channel provider connection.' })
  testConnection(
    @Param('id') id: string,
    @CurrentOrg() org: PublicOrg,
    @CurrentChannelAccess() access: ChannelAccess,
  ) {
    return this.service.testConnection(id, this.caller(org, access));
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Start a history sync for the channel.' })
  sync(
    @Param('id') id: string,
    @CurrentOrg() org: PublicOrg,
    @CurrentChannelAccess() access: ChannelAccess,
  ) {
    return this.service.syncChannel(id, this.caller(org, access));
  }

  @Get(':id/sync/status')
  @ApiOperation({ summary: 'Get the latest sync job status for the channel.' })
  syncStatus(
    @Param('id') id: string,
    @CurrentOrg() org: PublicOrg,
    @CurrentChannelAccess() access: ChannelAccess,
  ) {
    return this.service.getSyncStatus(id, this.caller(org, access));
  }

  @Post(':id/sync/cancel')
  @ApiOperation({ summary: 'Cancel the active sync for the channel.' })
  syncCancel(
    @Param('id') id: string,
    @CurrentOrg() org: PublicOrg,
    @CurrentChannelAccess() access: ChannelAccess,
  ) {
    return this.service.cancelSync(id, this.caller(org, access));
  }
}
