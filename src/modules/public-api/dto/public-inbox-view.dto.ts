import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Mirrors the internal InboxViewFiltersDto so the Public API validates the
 * exact same filter shape the internal InboxViewsService consumes. Kept as a
 * standalone class (not imported) to keep the public contract stable even if
 * the internal DTO evolves.
 */
export class PublicInboxViewFiltersDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  channelIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  statuses?: string[];

  /** "me" = key holder, "none" = unassigned, "any" = no filter, or a userId */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagIds?: string[];

  @ApiPropertyOptional({ enum: ['INDIVIDUAL', 'GROUP'] })
  @IsOptional()
  @IsString()
  @IsIn(['INDIVIDUAL', 'GROUP'])
  kind?: 'INDIVIDUAL' | 'GROUP';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  conversationIds?: string[];

  @ApiPropertyOptional({ enum: ['exclude', 'only', 'any'] })
  @IsOptional()
  @IsString()
  @IsIn(['exclude', 'only', 'any'])
  archived?: 'exclude' | 'only' | 'any';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;
}

export class PublicCreateInboxViewDto {
  @ApiProperty()
  @IsString()
  @Length(1, 60)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ type: PublicInboxViewFiltersDto })
  @ValidateNested()
  @Type(() => PublicInboxViewFiltersDto)
  filters!: PublicInboxViewFiltersDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class PublicUpdateInboxViewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 60)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ type: PublicInboxViewFiltersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PublicInboxViewFiltersDto)
  filters?: PublicInboxViewFiltersDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class PublicReorderInboxViewsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  orderedIds!: string[];
}
