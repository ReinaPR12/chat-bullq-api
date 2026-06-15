import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyAuthGuard } from '../../../common/guards';
import { CurrentOrg, CurrentUser } from '../../../common/decorators';
import { PublicSendMessageDto } from '../dto/public-send-message.dto';
import { PublicMessagesService } from '../services/public-messages.service';
import { PublicMediaService } from '../services/public-media.service';

@ApiTags('Public API · Messages')
@ApiSecurity('api-key')
@UseGuards(ApiKeyAuthGuard)
@Controller('public/messages')
export class PublicMessagesController {
  constructor(
    private readonly service: PublicMessagesService,
    private readonly media: PublicMediaService,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Envia uma mensagem via API key. Use toPhone (resolve/cria conversa) ou conversationId (envia em conversa existente). Informe apenas um dos dois.',
  })
  async send(
    @Body() dto: PublicSendMessageDto,
    @CurrentUser('id') userId: string,
    @CurrentOrg('id') organizationId: string,
  ) {

    if (dto.toPhone && dto.conversationId) {
      throw new BadRequestException(
        'Informe apenas um: toPhone ou conversationId',
      );
    }

    if (dto.conversationId) {
      return this.service.sendToConversation({
        organizationId,
        senderId: userId,
        conversationId: dto.conversationId,
        type: dto.type ?? 'TEXT',
        content: dto.content,
      });
    }

    return this.service.sendToPhone({
      organizationId,
      senderId: userId,
      channelId: dto.channelId,
      toPhone: dto.toPhone!,
      type: dto.type ?? 'TEXT',
      content: dto.content,
    });
  }

  @Get(':id/media')
  @ApiOperation({
    summary:
      'Resolve a mídia (lazy) de uma mensagem inbound. Org inferida da API key.',
  })
  getMedia(@Param('id') id: string, @CurrentOrg('id') organizationId: string) {
    return this.media.resolveMedia(id, organizationId);
  }

  @Post(':id/transcribe')
  @ApiOperation({
    summary:
      'Transcreve uma mensagem de áudio via Whisper (cacheado). Org inferida da API key.',
  })
  @ApiQuery({ name: 'force', required: false })
  transcribe(
    @Param('id') id: string,
    @CurrentOrg('id') organizationId: string,
    @Query('force') force?: string,
  ) {
    return this.media.transcribe(
      id,
      organizationId,
      force === 'true' || force === '1',
    );
  }
}
