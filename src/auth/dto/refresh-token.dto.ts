import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'رمز التحديث مطلوب' })
  refreshToken!: string;
}
