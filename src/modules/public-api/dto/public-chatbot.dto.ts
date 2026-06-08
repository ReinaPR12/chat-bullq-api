import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Shape of a single node as accepted by the Public Chatbot API. Mirrors the
 * internal ChatbotNode persistence model: `type` is one of the
 * ChatbotNodeType enum values (START, MESSAGE, MENU, CONDITION, WAIT, ACTION,
 * TRANSFER, END_FLOW), `data` is the type-specific payload, and `edges` are the
 * outgoing transitions ({ targetNodeId, condition? }).
 */
export class PublicChatbotNodeDto {
  @ApiPropertyOptional({ description: 'Existing node id (ignored on replace).' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({
    enum: [
      'START',
      'MESSAGE',
      'MENU',
      'CONDITION',
      'WAIT',
      'ACTION',
      'TRANSFER',
      'END_FLOW',
    ],
  })
  @IsString()
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  positionX?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  positionY?: number;

  @ApiProperty({ example: { message: 'Olá {{name}}' } })
  @IsObject()
  data: Record<string, any>;

  @ApiProperty({
    type: 'array',
    example: [{ targetNodeId: 'node-2', condition: 'true' }],
  })
  @IsArray()
  edges: { targetNodeId: string; condition?: string }[];
}

export class PublicCreateChatbotFlowDto {
  @ApiProperty({ example: 'Atendimento Inicial' })
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['KEYWORD', 'ALWAYS', 'FIRST_MESSAGE'] })
  @IsOptional()
  @IsString()
  triggerType?: string;

  @ApiPropertyOptional({ example: { keywords: ['oi', 'menu'] } })
  @IsOptional()
  @IsObject()
  triggerConfig?: Record<string, any>;

  @ApiPropertyOptional({ type: [PublicChatbotNodeDto] })
  @IsOptional()
  @IsArray()
  nodes?: PublicChatbotNodeDto[];

  // Accepted as an alias for nodes-only graphs; edges live inside each node.
  @ApiPropertyOptional({
    description: 'Ignored — edges are declared per-node under node.edges.',
  })
  @IsOptional()
  @IsArray()
  edges?: any[];
}

export class PublicUpdateChatbotFlowDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Lifecycle status. "ACTIVE" sets isActive=true, anything else (e.g. "DRAFT"/"INACTIVE") sets isActive=false.',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  triggerType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  triggerConfig?: Record<string, any>;

  @ApiPropertyOptional({ type: [PublicChatbotNodeDto] })
  @IsOptional()
  @IsArray()
  nodes?: PublicChatbotNodeDto[];

  @ApiPropertyOptional({
    description: 'Ignored — edges are declared per-node under node.edges.',
  })
  @IsOptional()
  @IsArray()
  edges?: any[];
}

export class PublicSimulateChatbotDto {
  @ApiPropertyOptional({
    description: 'Incoming user message text fed to the current node.',
    example: '1',
  })
  @IsOptional()
  @IsString()
  input?: string;

  @ApiPropertyOptional({
    description:
      'Opaque session state returned by a previous simulate call. Omit to start a fresh run from the START node.',
  })
  @IsOptional()
  @IsObject()
  sessionState?: Record<string, any>;
}
