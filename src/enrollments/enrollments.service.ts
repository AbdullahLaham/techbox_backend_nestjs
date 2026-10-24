// import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
// import { PrismaService } from '../prisma/prisma.service.js';
// import { EnrollDto } from './dto/enroll.dto.js';

// @Injectable()
// export class EnrollmentsService {
//   constructor(private readonly prisma: PrismaService) {}

//   async enrollStudent(
//     userId: string,
//     programId: string,
//     dto: EnrollDto,
//     receiptFile?: Express.Multer.File,
//   ) {
//     // 1. جلب البرنامج مع المقاعد (بعد تحديث الـ Schema)
//     const program = await (this.prisma.program as any).findUnique({
//       where: { id: programId },
//       include: {
//         _count: { select: { enrollments: true } },
//       },
//     });


//     if (!program) throw new NotFoundException('البرنامج غير موجود');

//     // التحقق من المقاعد المتاحة
//     if (program.maxSeats && program._count.enrollments >= program.maxSeats) {
//       throw new ConflictException('عذراً، اكتمل العدد الأقصى للمقاعد في هذه الدفعة (Sold Out)');
//     }

//     // 2. التحقق من عدم التسجيل المسبق
//     const existingEnrollment = await this.prisma.enrollment.findUnique({
//       where: { userId_programId: { userId, programId } },
//     });

//     if (existingEnrollment) throw new BadRequestException('أنت مسجل بالفعل في هذا البرنامج');

//     // 3. تحديث بروفايل المستخدم بالبيانات الجديدة
//     const userProfile = await this.prisma.userProfile.findUnique({ where: { userId } });

//     if (userProfile) {
//       await this.prisma.userProfile.update({
//         where: { userId },
//         data: {
//           fullNameEn: userProfile.fullNameEn || dto.fullNameEn,
//           fullNameAr: userProfile.fullNameAr || dto.fullNameAr,
//           age: userProfile.age || dto.age,
//           phoneNumber: userProfile.phoneNumber || dto.phoneWhatsApp,
//           // استخدام metadata أو الحقول الخاصة إذا أردت حفظ بقية البيانات
//           metadata: {
//             nationalId: dto.nationalId,
//             governorate: dto.governorate,
//           },
//         },
//       });
//     }

//     const paymentReceiptUrl = receiptFile ? `/uploads/${receiptFile.filename}` : null;

//     // 4. إنشاء التسجيل
//     return this.prisma.enrollment.create({
//       data: {
//         userId,
//         programId,
//         status: 'PENDING', // تتطلب تحديث الـ Enum في الـ Schema
//         paymentReceipt: paymentReceiptUrl,
//       } as any,
//       include: { program: true },
//     });
//   }

//   async getStudentEnrollments(userId: string) {
//     return this.prisma.enrollment.findMany({
//       where: { userId },
//       include: { program: true },
//     });
//   }
// }



import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EnrollDto } from './dto/enroll.dto.js';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async enrollStudent(
    userId: string,
    programId: string,
    dto: EnrollDto,
    receiptFile?: Express.Multer.File,
  ) {
    // 1. جلب البرنامج والتحقق من حالة الدفعة والمقاعد
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      include: {
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!program) {
      throw new NotFoundException('البرنامج التدريبي أو الحاضنة غير موجودة');
    }

    if (program.status !== 'PUBLISHED' && program.status !== 'ONGOING') {
      throw new BadRequestException('عذراً، هذا البرنامج غير متاح للتسجيل حالياً');
    }

    // التحقق من اكتمال المقاعد (Cohort-Based Scarcity)
    if (program.maxSeats && program._count.enrollments >= program.maxSeats) {
      throw new ConflictException('عذراً، اكتمل العدد الأقصى للمقاعد في هذه الدفعة (Sold Out)');
    }

    // 2. التحقق مما إذا كان الطالب مسجلاً مسبقاً
    const existingEnrollment = await this.prisma.enrollment.findUnique({
      where: {
        userId_programId: { userId, programId },
      },
    });

    if (existingEnrollment) {
      throw new BadRequestException('أنت مسجل بالفعل في هذا البرنامج');
    }

    // 3. تحديث بيانات المستخدم الأساسية في UserProfile (إذا لم تكن موجودة مسبقاً)
    const userProfile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });

    if (userProfile) {
      await this.prisma.userProfile.update({
        where: { userId },
        data: {
          fullNameEn: userProfile.fullNameEn || dto.fullNameEn,
          fullNameAr: userProfile.fullNameAr || dto.fullNameAr,
          age: userProfile.age || dto.age,
          phoneWhatsApp: userProfile.phoneWhatsApp || dto.phoneWhatsApp,
          nationalId: userProfile.nationalId || dto.nationalId,
          governorate: userProfile.governorate || dto.governorate,
        },
      });
    }

    // 4. تجهيز مسار إيصال التحويل إن وُجد
    const paymentReceiptUrl = receiptFile ? `/uploads/${receiptFile.filename}` : null;

    // 5. إنشاء سجل التسجيل بحالة PENDING (بانتظار مراجعة الإيصال من الإدارة)
    return this.prisma.enrollment.create({
      data: {
        userId,
        programId,
        status: 'PENDING',
        paymentReceipt: paymentReceiptUrl,
      },
      include: {
        program: true,
      },
    });
  }

  // جلب مساقات وبرامج الطالب المسجل بها
  async getStudentEnrollments(userId: string) {
    return this.prisma.enrollment.findMany({
      where: { userId },
      include: {
        program: {
          include: {
            _count: { select: { tracks: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}