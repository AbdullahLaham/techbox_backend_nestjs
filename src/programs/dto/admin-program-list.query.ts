import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ProgramStatus, ProgramType } from '@prisma/client';
import { TrimToNull } from '../../common/dto-transforms.js';

/** Query of GET /v1/admin/programs (AdminProgramListQuery). */
export class AdminProgramListQuery {
  @IsOptional()
  @IsEnum(ProgramStatus)
  status?: ProgramStatus;

  @IsOptional()
  @IsEnum(ProgramType)
  type?: ProgramType;

  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string | null;
}
