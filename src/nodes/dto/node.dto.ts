import { OmitType, PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Trim, TrimToNull } from '../../common/dto-transforms.js';
import { MANAGED_NODE_TYPES, NODE_LIMITS, QUIZ_LIMITS, type ManagedNodeType } from '../../types/nodes.contract.js';

const URL_OPTIONS = { protocols: ['http', 'https'], require_protocol: true };

export class NodeVideoDto {
  @Trim()
  @MaxLength(NODE_LIMITS.urlMax)
  @IsUrl(URL_OPTIONS, { message: 'رابط تشغيل الفيديو غير صالح' })
  playbackUrl: string;

  @IsInt()
  @Min(0)
  durationSec: number;

  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  externalId?: string;
}

/** QuizSettingsBody in nodes.contract.ts. */
export class QuizSettingsDto {
  @Trim()
  @IsOptional()
  @IsString()
  @Length(1, QUIZ_LIMITS.titleMax)
  title?: string;

  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(QUIZ_LIMITS.descriptionMax)
  description?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(99999.99)
  passingScore?: number;

  /** null = unlimited */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  @Max(100)
  maxAttempts?: number | null;

  @IsOptional()
  @IsBoolean()
  showCorrectAnswers?: boolean;
}

/** Body of POST /v1/admin/nodes (CreateNodeBody in nodes.contract.ts). */
export class CreateNodeDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  moduleId: string;

  @IsIn(MANAGED_NODE_TYPES, { message: 'نوع الدرس يجب أن يكون QUIZ أو VIDEO_LECTURE أو READING_MATERIAL' })
  type: ManagedNodeType;

  @Trim()
  @IsString()
  @Length(1, NODE_LIMITS.titleMax, { message: 'العنوان مطلوب' })
  title: string;

  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(NODE_LIMITS.descriptionMax)
  description?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => NodeVideoDto)
  video?: NodeVideoDto;

  /** READING_MATERIAL: external link to the material. */
  @Trim()
  @IsOptional()
  @MaxLength(NODE_LIMITS.urlMax)
  @IsUrl(URL_OPTIONS, { message: 'الرابط غير صالح' })
  link?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => QuizSettingsDto)
  quiz?: QuizSettingsDto;
}

class PartialNodeVideoDto extends PartialType(NodeVideoDto) {}

/** Body of PATCH /v1/admin/nodes/:nodeId. moduleId and type cannot change. */
export class UpdateNodeDto extends PartialType(OmitType(CreateNodeDto, ['moduleId', 'type', 'video', 'quiz'] as const)) {
  @IsOptional()
  @ValidateNested()
  @Type(() => PartialNodeVideoDto)
  video?: PartialNodeVideoDto;
}

export class ListNodesQuery {
  @Trim()
  @IsString()
  @IsNotEmpty()
  moduleId: string;
}
