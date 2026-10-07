import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'يرجى تقديم بريد إلكتروني صحيح' })
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'كلمة المرور يجب أن لا تقل عن 8 حروف' })
  password!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsString()
  @IsOptional()
  bio?: string;
}