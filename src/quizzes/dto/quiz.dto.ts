import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Trim, TrimToNull } from '../../common/dto-transforms.js';
import { QuizSettingsDto } from '../../nodes/dto/node.dto.js';
import { QUIZ_LIMITS } from '../../types/nodes.contract.js';

/** PATCH /v1/admin/quizzes/:quizId (UpdateQuizBody). */
export class UpdateQuizDto extends QuizSettingsDto {
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class QuizOptionDto {
  @Trim()
  @IsString()
  @Length(1, QUIZ_LIMITS.optionTextMax, { message: 'نص الخيار مطلوب' })
  text: string;

  @IsBoolean()
  isCorrect: boolean;
}

/** POST /v1/admin/quizzes/:quizId/questions (CreateQuizQuestionBody). */
export class CreateQuizQuestionDto {
  @Trim()
  @IsString()
  @Length(1, QUIZ_LIMITS.questionTextMax, { message: 'نص السؤال مطلوب' })
  text: string;

  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(QUIZ_LIMITS.explanationMax)
  explanation?: string | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(QUIZ_LIMITS.pointsMax)
  points?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;

  @IsArray()
  @ArrayMinSize(QUIZ_LIMITS.optionsPerQuestion, { message: 'لكل سؤال 4 خيارات بالضبط' })
  @ArrayMaxSize(QUIZ_LIMITS.optionsPerQuestion, { message: 'لكل سؤال 4 خيارات بالضبط' })
  @ValidateNested({ each: true })
  @Type(() => QuizOptionDto)
  options: QuizOptionDto[];
}

/** PATCH /v1/admin/quizzes/questions/:questionId (UpdateQuizQuestionBody). */
export class UpdateQuizQuestionDto extends PartialType(CreateQuizQuestionDto) {}

export class QuizAnswerDto {
  @IsString()
  @IsNotEmpty()
  questionId: string;

  /** null = not answered */
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @IsNotEmpty()
  optionId: string | null;
}

/** POST /v1/quizzes/:quizId/attempts (SubmitQuizBody). */
export class SubmitQuizDto {
  @IsArray()
  @ArrayMaxSize(QUIZ_LIMITS.questionsMax)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers: QuizAnswerDto[];
}

/** GET /v1/admin/quizzes/:quizId/attempts (AdminQuizAttemptListQuery). */
export class AdminQuizAttemptListQueryDto {
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
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  passed?: boolean;

  @Trim()
  @IsOptional()
  @IsString()
  studentId?: string;
}
