import { IsString, IsOptional, IsObject, IsBoolean, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Public-API channel update payload. Restricted to the fields the CRM edits:
 * rename, enable/disable, change visibility, or patch provider credentials.
 * Org is inferred from the API key.
 */
export class PublicUpdateChannelDto {
  @ApiPropertyOptional({ example: 'WhatsApp Vendas (novo nome)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Enable/disable the channel.' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: ['ORG', 'PRIVATE'] })
  @IsOptional()
  @IsIn(['ORG', 'PRIVATE'])
  visibility?: 'ORG' | 'PRIVATE';

  @ApiPropertyOptional({
    description: 'Replace provider credentials.',
    example: { token: 'new-zappfy-token' },
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}
