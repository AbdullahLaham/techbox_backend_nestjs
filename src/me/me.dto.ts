import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { Trim, TrimToNull } from '../common/dto-transforms.js';
import { PROFILE_LIMITS as L } from '../types/profile.contract.js';

/** Present (not undefined) and not null: required-if-sent fields such as the first name. */
const IfSent = () => ValidateIf((_, value) => value !== undefined);

/** Body of PATCH /v1/me/profile (UpdateMyProfileBody). */
export class UpdateMyProfileDto {
  @Trim()
  @IfSent()
  @IsString({ message: 'الاسم الأول غير صالح' })
  @IsNotEmpty({ message: 'الاسم الأول مطلوب' })
  @MaxLength(L.nameMax, { message: `الاسم الأول يجب ألا يتجاوز ${L.nameMax} حرفاً` })
  firstName?: string;

  @Trim()
  @IfSent()
  @IsString({ message: 'اسم العائلة غير صالح' })
  @IsNotEmpty({ message: 'اسم العائلة مطلوب' })
  @MaxLength(L.nameMax, { message: `اسم العائلة يجب ألا يتجاوز ${L.nameMax} حرفاً` })
  lastName?: string;

  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(L.bioMax, { message: `النبذة يجب ألا تتجاوز ${L.bioMax} حرف` })
  bio?: string | null;

  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(L.fullNameMax, { message: 'الاسم الثلاثي بالعربي طويل جداً' })
  fullNameAr?: string | null;

  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(L.fullNameMax, { message: 'الاسم الكامل بالإنجليزية طويل جداً' })
  fullNameEn?: string | null;

  @IsOptional()
  @IsInt({ message: 'العمر غير صالح' })
  @Min(L.ageMin, { message: 'العمر غير صالح' })
  @Max(L.ageMax, { message: 'العمر غير صالح' })
  age?: number | null;

  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(L.phoneMax, { message: 'رقم الواتساب غير صالح' })
  phoneWhatsApp?: string | null;

  @TrimToNull()
  @IsOptional()
  @IsString()
  @MaxLength(L.governorateMax, { message: 'المحافظة غير صالحة' })
  governorate?: string | null;
}

/** Body of POST /v1/me/password (ChangePasswordBody). */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'كلمة المرور الحالية مطلوبة' })
  @MaxLength(200)
  currentPassword!: string;

  @IsString()
  @MinLength(L.passwordMin, { message: `كلمة المرور يجب أن لا تقل عن ${L.passwordMin} حروف` })
  @MaxLength(L.passwordMax, { message: `كلمة المرور يجب ألا تتجاوز ${L.passwordMax} حرفاً` })
  newPassword!: string;
}

/** Body of DELETE /v1/me (DeleteAccountBody). */
export class DeleteAccountDto {
  @IsString()
  @IsNotEmpty({ message: 'أدخل كلمة المرور لتأكيد حذف الحساب' })
  @MaxLength(200)
  password!: string;
}
