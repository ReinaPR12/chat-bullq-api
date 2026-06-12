import {
  IsString,
  IsOptional,
  IsObject,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Envio server-to-server via API key (integração externa, ex.: CRM Meridial).
 *
 * Regra de roteamento (um ou outro, nunca os dois):
 *   - toPhone: resolve/cria a conversa a partir de (channelId, telefone)
 *     reusando os resolvers do pipeline.
 *   - conversationId: envia diretamente na conversa existente.
 *
 * Ambos ausentes → validação falha (ao menos um é obrigatório).
 * Ambos presentes → aceito pelo DTO; o controller rejeita com 400.
 */
export class PublicSendMessageDto {
  @ApiProperty({ description: 'ID do canal (instância) da organização', example: 'channel-id' })
  @IsString()
  channelId: string;

  /**
   * Telefone de destino (E.164 ou dígitos). Obrigatório quando conversationId
   * não foi informado.
   */
  @ApiPropertyOptional({ description: 'Telefone de destino (E.164 ou dígitos)', example: '+5511999998888' })
  @ValidateIf((o) => !o.conversationId)
  @IsString()
  toPhone?: string;

  /**
   * ID de uma conversa existente. Obrigatório quando toPhone não foi
   * informado.
   */
  @ApiPropertyOptional({ description: 'ID de conversa existente', example: 'conv-uuid' })
  @ValidateIf((o) => !o.toPhone)
  @IsString()
  conversationId?: string;

  @ApiPropertyOptional({ enum: ['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT'], default: 'TEXT' })
  @IsOptional()
  @IsEnum(['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT'])
  type?: string;

  @ApiProperty({ description: 'Conteúdo da mensagem', example: { text: 'Olá!' } })
  @IsObject()
  content: Record<string, any>;
}
