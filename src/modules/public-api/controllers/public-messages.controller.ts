import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyAuthGuard } from '../../../common/guards';
import { CurrentOrg, CurrentUser } from '../../../common/decorators';
import { PublicSendMessageDto } from '../dto/public-send-message.dto';
import { PublicMessagesService } from '../services/public-messages.service';

@ApiTags('Public API · Messages')
@ApiSecurity('api-key')
@UseGuards(ApiKeyAuthGuard)
@Controller('public/messages')
export class PublicMessagesController {
  constructor(private readonly service: PublicMessagesService) {}

  @Post()
  @ApiOperation({
    summary:
      'Envia uma mensagem para um telefone (resolve/cria conversa). Server-to-server via API key.',
  })
  send(
    @Body() dto: PublicSendMessageDto,
    @CurrentUser('id') userId: string,
    @CurrentOrg('id') organizationId: string,
  ) {
    return this.service.sendToPhone({
      organizationId,
      senderId: userId,
      channelId: dto.channelId,
      toPhone: dto.toPhone,
      type: dto.type ?? 'TEXT',
      content: dto.content,
    });
  }
}
