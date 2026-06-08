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
import { CurrentOrg, CurrentUser } from '../../../common/decorators';
import {
  PublicCreateTagDto,
  PublicUpdateTagDto,
} from '../dto/public-tag.dto';
import {
  PublicTagsService,
  type PublicTagsCaller,
} from '../services/public-tags.service';

type PublicOrg = { id: string };
type PublicUser = { id: string };

@ApiTags('Public API · Tags')
@ApiSecurity('api-key')
@UseGuards(ApiKeyAuthGuard)
@Controller('public/tags')
export class PublicTagsController {
  constructor(private readonly service: PublicTagsService) {}

  private caller(org: PublicOrg, user: PublicUser): PublicTagsCaller {
    return { organizationId: org.id, actorId: user.id };
  }

  @Get()
  @ApiOperation({ summary: 'List tags for the API key organization.' })
  findAll(@CurrentOrg() org: PublicOrg, @CurrentUser() user: PublicUser) {
    return this.service.findAll(this.caller(org, user));
  }

  @Post()
  @ApiOperation({ summary: 'Create a tag scoped to the API key organization.' })
  create(
    @Body() dto: PublicCreateTagDto,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
  ) {
    return this.service.create(dto, this.caller(org, user));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a tag (name, color) — org-scoped.' })
  update(
    @Param('id') id: string,
    @Body() dto: PublicUpdateTagDto,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
  ) {
    return this.service.update(id, dto, this.caller(org, user));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a tag (org-scoped).' })
  remove(
    @Param('id') id: string,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
  ) {
    return this.service.remove(id, this.caller(org, user));
  }

  @Post('conversation/:conversationId/tag/:tagId')
  @ApiOperation({ summary: 'Apply a tag to a conversation (org-scoped).' })
  addToConversation(
    @Param('conversationId') conversationId: string,
    @Param('tagId') tagId: string,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
  ) {
    return this.service.addToConversation(
      conversationId,
      tagId,
      this.caller(org, user),
    );
  }

  @Delete('conversation/:conversationId/tag/:tagId')
  @ApiOperation({ summary: 'Remove a tag from a conversation (org-scoped).' })
  removeFromConversation(
    @Param('conversationId') conversationId: string,
    @Param('tagId') tagId: string,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
  ) {
    return this.service.removeFromConversation(
      conversationId,
      tagId,
      this.caller(org, user),
    );
  }

  @Post('contact/:contactId/tag/:tagId')
  @ApiOperation({ summary: 'Apply a tag to a contact (org-scoped).' })
  addToContact(
    @Param('contactId') contactId: string,
    @Param('tagId') tagId: string,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
  ) {
    return this.service.addToContact(contactId, tagId, this.caller(org, user));
  }

  @Delete('contact/:contactId/tag/:tagId')
  @ApiOperation({ summary: 'Remove a tag from a contact (org-scoped).' })
  removeFromContact(
    @Param('contactId') contactId: string,
    @Param('tagId') tagId: string,
    @CurrentOrg() org: PublicOrg,
    @CurrentUser() user: PublicUser,
  ) {
    return this.service.removeFromContact(
      contactId,
      tagId,
      this.caller(org, user),
    );
  }
}
