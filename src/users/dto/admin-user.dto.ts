import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsIn, IsInt, IsOptional, IsString, Length, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { GlobalRole, UserStatus } from '@prisma/client';
import { Trim, TrimToNull } from '../../common/dto-transforms.js';
import { USER_LIMITS, type AdminUserSort } from '../../types/api.contract.js';

const SORTS: AdminUserSort[] = ['createdAt', '-createdAt', 'email', '-email', 'lastSeenAt', '-lastSeenAt'];
const SETTABLE: UserStatus[] = [UserStatus.ACTIVE, UserStatus.SUSPENDED, UserStatus.ARCHIVED];

/** Query of GET /v1/admin/users (AdminUserListQuery). */
export class AdminUserListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(USER_LIMITS.pageSizeMax)
  pageSize: number = 20;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsEnum(GlobalRole)
  role?: GlobalRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsIn(SORTS)
  sort: AdminUserSort = '-createdAt';
}

class PasswordField {
  @IsString()
  @Length(USER_LIMITS.passwordMin, USER_LIMITS.passwordMax, {
    message: `كلمة المرور يجب أن تكون بين ${USER_LIMITS.passwordMin} و ${USER_LIMITS.passwordMax} حرفاً`,
  })
  password: string;
}

/** Body of POST /v1/admin/users (CreateUserBody). */
export class CreateUserDto extends PasswordField {
  @Trim()
  @IsEmail({}, { message: 'يرجى تقديم بريد إلكتروني صحيح' })
  @MaxLength(254)
  email: string;

  @Trim()
  @IsString()
  @Length(1, USER_LIMITS.nameMax, { message: 'الاسم الأول مطلوب' })
  firstName: string;

  @Trim()
  @IsString()
  @Length(1, USER_LIMITS.nameMax, { message: 'اسم العائلة مطلوب' })
  lastName: string;

  @IsEnum(GlobalRole, { message: 'الصلاحية غير صالحة' })
  role: GlobalRole;

  @TrimToNull()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(USER_LIMITS.phoneMax)
  phoneNumber?: string | null;
}

/** Body of PATCH /v1/admin/users/:id (UpdateUserBody). */
export class UpdateUserDto {
  @Trim()
  @IsOptional()
  @IsString()
  @Length(1, USER_LIMITS.nameMax, { message: 'الاسم الأول مطلوب' })
  firstName?: string;

  @Trim()
  @IsOptional()
  @IsString()
  @Length(1, USER_LIMITS.nameMax, { message: 'اسم العائلة مطلوب' })
  lastName?: string;

  @TrimToNull()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsString()
  @MaxLength(USER_LIMITS.phoneMax)
  phoneNumber?: string | null;
}

/** Body of PATCH /v1/admin/users/:id/role. */
export class ChangeUserRoleDto {
  @IsEnum(GlobalRole, { message: 'الصلاحية غير صالحة' })
  role: GlobalRole;
}

/** Body of PATCH /v1/admin/users/:id/status. */
export class ChangeUserStatusDto {
  @IsIn(SETTABLE, { message: 'الحالة يجب أن تكون ACTIVE أو SUSPENDED أو ARCHIVED' })
  status: UserStatus;
}

/** Body of POST /v1/admin/users/:id/password. */
export class ResetUserPasswordDto extends PasswordField {}
