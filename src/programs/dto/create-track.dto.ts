import { IsInt, IsOptional, IsString, Length, MaxLength, Min } from 'class-validator';
import { Trim, TrimToNull } from '../../common/dto-transforms.js';
import { PROGRAM_LIMITS } from '../../types/api.contract.js';

/** Body of POST .../tracks and .../modules (CreateTrackBody / CreateModuleBody). */
export class CreateTrackDto {
  @Trim()
  @IsString()
  @Length(1, PROGRAM_LIMITS.curriculumTitleMax, { message: 'العنوان مطلوب' })
  title: string;

  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(PROGRAM_LIMITS.curriculumDescriptionMax)
  description?: string | null;

  /** Default: last position. */
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}
