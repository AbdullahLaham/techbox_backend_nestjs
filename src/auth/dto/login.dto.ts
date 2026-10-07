import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'يرجى تقديم بريد إلكتروني صحيح' })
  @IsNotEmpty()
  email!: string;

  @IsString()
  @MinLength(8, { message: 'كلمة المرور يجب أن لا تقل عن 8 حروف' })
  password!: string;
}