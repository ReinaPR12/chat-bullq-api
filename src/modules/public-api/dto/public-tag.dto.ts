import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const HEX_COLOR = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

export class PublicCreateTagDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional({ default: '#6B7280' })
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, {
    message: 'color must be a valid hex color (e.g. #6B7280)',
  })
  color?: string;
}

export class PublicUpdateTagDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR, {
    message: 'color must be a valid hex color (e.g. #6B7280)',
  })
  color?: string;
}
