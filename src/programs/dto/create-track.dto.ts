import { IsString, IsInt, IsOptional, Min } from 'class-validator';

export class CreateTrackDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  orderIndex?: number;
}