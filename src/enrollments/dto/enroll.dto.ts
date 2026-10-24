import { IsString, IsNotEmpty, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class EnrollDto {
  @IsString()
  @IsNotEmpty({ message: 'الاسم الكامل بالإنجليزية مطلوب' })
  fullNameEn: string;

  @IsString()
  @IsNotEmpty({ message: 'الاسم الثلاثي بالعربي مطلوب' })
  fullNameAr: string;

  @Type(() => Number)
  @IsInt()
  @Min(10, { message: 'العمر غير صالح' })
  age: number;

  @IsString()
  @IsNotEmpty({ message: 'رقم الواتساب مطلوب' })
  phoneWhatsApp: string;

  @IsString()
  @IsNotEmpty({ message: 'رقم الهوية مطلوب' })
  nationalId: string;

  @IsString()
  @IsNotEmpty({ message: 'المحافطة مطلوبة' })
  governorate: string;
}