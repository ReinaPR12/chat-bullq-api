import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Body for rejecting a pending action. A non-empty reason is required — the
 * internal PendingActionService rejects empty reasons with 400.
 */
export class PublicRejectPendingActionDto {
  @ApiProperty({ example: 'Cliente não autorizou a liberação.' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}
