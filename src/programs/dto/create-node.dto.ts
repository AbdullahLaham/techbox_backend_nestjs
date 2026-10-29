import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { NodeType, SubmissionType } from '@prisma/client';
import { Trim, TrimToNull } from '../../common/dto-transforms.js';
import { PROGRAM_LIMITS } from '../../types/api.contract.js';

export class VideoDataDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  externalId: string;

  @IsInt()
  @Min(0)
  durationSec: number;

  @Trim()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: 'رابط تشغيل الفيديو غير صالح' })
  playbackUrl: string;
}

/**
 * Assignment fields of an ASSIGNMENT lesson. Only the shape is checked here; the
 * assignment rules (lengths, maxScore, future dueDate) are applied by
 * AdminAssignmentsService, so they are identical to /v1/admin/assignments.
 */
export class AssignmentDataDto {
  @IsString()
  instructions: string;

  @IsOptional()
  @IsEnum(SubmissionType)
  allowedType?: SubmissionType;

  @IsOptional()
  @IsNumber()
  maxScore?: number;

  /** ISO date-time, or null for no deadline. */
  @IsOptional()
  @IsString()
  dueDate?: string | null;
}

/** Body of POST .../modules/:moduleId/nodes (CreateNodeBody in api.contract.ts). */
export class CreateNodeDto {
  @Trim()
  @IsString()
  @Length(1, PROGRAM_LIMITS.curriculumTitleMax, { message: 'العنوان مطلوب' })
  title: string;

  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(PROGRAM_LIMITS.curriculumDescriptionMax)
  description?: string | null;

  @IsEnum(NodeType)
  type: NodeType;

  /** Default: last position. */
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => VideoDataDto)
  videoData?: VideoDataDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AssignmentDataDto)
  assignmentData?: AssignmentDataDto;
}
