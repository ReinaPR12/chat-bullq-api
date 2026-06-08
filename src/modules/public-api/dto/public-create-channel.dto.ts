import { IsEnum, IsString, IsOptional, IsObject, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChannelType } from '@prisma/client';

/**
 * Public-API channel creation payload. Mirrors the internal CreateChannelDto
 * but exposes only the fields a server-to-server integration (CRM) needs.
 * The organization is inferred from the API key — never sent in the body.
 */
export class PublicCreateChannelDto {
  @ApiProperty({ enum: ChannelType, example: 'WHATSAPP_ZAPPFY' })
  @IsEnum(ChannelType)
  type: ChannelType;

  @ApiProperty({ example: 'WhatsApp Vendas' })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description:
      'Provider credentials (e.g. { token } for Zappfy, { accessToken, phoneNumberId } for WhatsApp Official).',
    example: { token: 'zappfy-instance-token' },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @ApiPropertyOptional({ enum: ['ORG', 'PRIVATE'] })
  @IsOptional()
  @IsIn(['ORG', 'PRIVATE'])
  visibility?: 'ORG' | 'PRIVATE';
}
