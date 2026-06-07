import { IsString, IsOptional, IsObject, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Envio server-to-server via API key (integração externa, ex.: CRM Meridial).
 * Diferente do SendMessageDto interno, NÃO recebe conversationId — resolve/cria
 * a conversa a partir de (channelId, toPhone) reusando os resolvers do pipeline.
 */
export class PublicSendMessageDto {
  @ApiProperty({ description: 'ID do canal (instância) da organização', example: 'channel-id' })
  @IsString()
  channelId: string;

  @ApiProperty({ description: 'Telefone de destino (E.164 ou dígitos)', example: '+5511999998888' })
  @IsString()
  toPhone: string;

  @ApiPropertyOptional({ enum: ['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT'], default: 'TEXT' })
  @IsOptional()
  @IsEnum(['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT'])
  type?: string;

  @ApiProperty({ description: 'Conteúdo da mensagem', example: { text: 'Olá!' } })
  @IsObject()
  content: Record<string, any>;
}
