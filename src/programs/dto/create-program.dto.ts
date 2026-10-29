import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ProgramStatus, ProgramType } from '@prisma/client';
import { Trim, TrimToNull } from '../../common/dto-transforms.js';
import { PROGRAM_LIMITS, SLUG_PATTERN } from '../../types/api.contract.js';

/** Body of POST /v1/admin/programs (CreateProgramBody in api.contract.ts). */
export class CreateProgramDto {
  @Trim()
  @IsString()
  @Length(PROGRAM_LIMITS.titleMin, PROGRAM_LIMITS.titleMax, {
    message: `العنوان يجب أن يكون بين ${PROGRAM_LIMITS.titleMin} و ${PROGRAM_LIMITS.titleMax} حرفاً`,
  })
  title: string;

  @Trim()
  @IsString()
  @MaxLength(PROGRAM_LIMITS.slugMax)
  @Matches(SLUG_PATTERN, {
    message: 'الرابط التعريفي يقبل الحروف الصغيرة والأرقام وشرطة واحدة بين الكلمات فقط',
  })
  slug: string;

  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(PROGRAM_LIMITS.descriptionMax)
  description?: string | null;

  @IsOptional()
  @IsEnum(ProgramType)
  type?: ProgramType;

  @IsOptional()
  @IsEnum(ProgramStatus)
  status?: ProgramStatus;

  @TrimToNull()
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }, { message: 'رابط صورة الغلاف غير صالح' })
  coverImage?: string | null;

  /** null = unlimited seats. */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  maxSeats?: number | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString({ strict: true })
  startDate?: string | null;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsDateString({ strict: true })
  endDate?: string | null;

  @IsOptional()
  @IsBoolean()
  isEnrollmentOpen?: boolean;
}
