import { IsString, IsEnum, IsOptional, IsUrl } from 'class-validator';
import { ProgramType, ProgramStatus } from '@prisma/client';

export class CreateProgramDto {
  @IsString()
  title: string;

  @IsString()
  slug: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(ProgramType)
  @IsOptional()
  type?: ProgramType;

  @IsEnum(ProgramStatus)
  @IsOptional()
  status?: ProgramStatus;

  @IsString()
  @IsOptional()
  coverImage?: string;
}