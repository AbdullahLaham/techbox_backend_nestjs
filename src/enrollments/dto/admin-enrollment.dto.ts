import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { EnrollmentStatus } from '@prisma/client';
import { TrimToNull } from '../../common/dto-transforms.js';
import type { AdminEnrollmentSort } from '../../types/api.contract.js';

const SORTS: AdminEnrollmentSort[] = ['createdAt', '-createdAt', 'updatedAt', '-updatedAt'];

/** Query of GET /v1/admin/enrollments (AdminEnrollmentListQuery). */
export class AdminEnrollmentListQueryDto {
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
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;

  @TrimToNull()
  @IsOptional()
  @IsString()
  programId?: string | null;

  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string | null;

  @IsOptional()
  @IsIn(SORTS)
  sort: AdminEnrollmentSort = '-createdAt';
}

/** Body of PATCH /v1/admin/enrollments/:id/status (UpdateEnrollmentStatusBody). */
export class UpdateEnrollmentStatusDto {
  @IsEnum(EnrollmentStatus)
  status: EnrollmentStatus;

  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}
