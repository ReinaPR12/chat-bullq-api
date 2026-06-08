import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationStatus } from '@prisma/client';

/**
 * Body for PATCH /public/conversations/:id. All fields optional; at least one
 * must be present. `unread` toggles per-user read state (true = mark unread,
 * false = mark read) — handled by the internal read-state path, not the
 * status/assignment update.
 */
export class PublicUpdateConversationDto {
  @ApiPropertyOptional({ enum: ConversationStatus })
  @IsOptional()
  @IsEnum(ConversationStatus)
  status?: ConversationStatus;

  @ApiPropertyOptional({
    description: 'User id to assign the conversation to.',
  })
  @IsOptional()
  @IsString()
  assignedTo?: string;

  @ApiPropertyOptional({
    description:
      'true marks the conversation unread for the API key holder; false marks it read.',
  })
  @IsOptional()
  @IsBoolean()
  unread?: boolean;
}
