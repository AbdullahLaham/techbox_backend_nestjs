import { IsString, IsEnum, IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { NodeType, SubmissionType } from '@prisma/client';

export class CreateNodeDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(NodeType)
  type: NodeType;

  @IsInt()
  @Min(0)
  @IsOptional()
  orderIndex?: number;

  @IsBoolean()
  @IsOptional()
  isMandatory?: boolean;

  @IsOptional()
  videoData?: {
    externalId: string;
    durationSec: number;
    playbackUrl: string;
  };

  @IsOptional()
  assignmentData?: {
    instructions: string;
    allowedType?: SubmissionType;
    maxScore?: number;
    dueDate?: string;
  };
}