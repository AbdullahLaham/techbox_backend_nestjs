import { IsString, IsNotEmpty, IsInt, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { Trim } from '../../common/dto-transforms.js';

/**
 * Text fields of POST /v1/enrollments/:programId (multipart/form-data),
 * EnrollmentApplicationFields in api.contract.ts.
 */
export class EnrollDto {
  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'الاسم الكامل بالإنجليزية مطلوب' })
  @MaxLength(150)
  fullNameEn: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'الاسم الثلاثي بالعربي مطلوب' })
  @MaxLength(150)
  fullNameAr: string;

  @Type(() => Number)
  @IsInt({ message: 'العمر غير صالح' })
  @Min(10, { message: 'العمر غير صالح' })
  @Max(100, { message: 'العمر غير صالح' })
  age: number;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'رقم الواتساب مطلوب' })
  @MaxLength(30)
  phoneWhatsApp: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'رقم الهوية مطلوب' })
  @MaxLength(30)
  nationalId: string;

  @Trim()
  @IsString()
  @IsNotEmpty({ message: 'المحافظة مطلوبة' })
  @MaxLength(100)
  governorate: string;
}
