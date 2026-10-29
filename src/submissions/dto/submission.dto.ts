import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { SubmissionStatus } from '@prisma/client';
import { Trim, TrimToNull } from '../../common/dto-transforms.js';
import { GRADE_STATUSES, SUBMISSION_LIMITS, type GradeStatus } from '../../types/submissions.contract.js';

/** Multipart sends a single `links` value as a plain string; JSON sends an array. */
const ToTrimmedArray = () =>
  Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    const list = Array.isArray(value) ? value : [value];
    return list.map((v) => (typeof v === 'string' ? v.trim() : v)).filter((v) => v !== '');
  });

/** Body of POST /v1/assignments/:assignmentId/submit (JSON or multipart text fields). */
export class SubmitAssignmentDto {
  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(SUBMISSION_LIMITS.textMax, { message: `النص يجب ألا يتجاوز ${SUBMISSION_LIMITS.textMax} حرف` })
  text?: string | null;

  @ToTrimmedArray()
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(SUBMISSION_LIMITS.maxLinks, { message: `يمكن إرسال ${SUBMISSION_LIMITS.maxLinks} روابط كحد أقصى` })
  @MaxLength(SUBMISSION_LIMITS.urlMax, { each: true })
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { each: true, message: 'الرابط غير صالح، يجب أن يبدأ بـ http أو https' })
  links?: string[];
}

/** Body of PATCH /v1/admin/submissions/:submissionId/grade (GradeSubmissionBody). */
export class GradeSubmissionDto {
  @IsIn(GRADE_STATUSES, { message: 'الحالة يجب أن تكون UNDER_REVIEW أو GRADED أو NEEDS_REVISION أو REJECTED' })
  status: GradeStatus;

  /** Range against the assignment's maxScore is checked by the service. */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'الدرجة يجب أن تكون رقماً بخانتين عشريتين كحد أقصى' })
  @Min(0)
  score?: number | null;

  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(SUBMISSION_LIMITS.feedbackMax)
  feedback?: string | null;
}

/** Query of GET /v1/admin/assignments/:assignmentId/submissions. */
export class AdminSubmissionListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;

  @IsOptional()
  @IsEnum(SubmissionStatus)
  status?: SubmissionStatus;

  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  latestOnly: boolean = true;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}
