import { 
  Controller, 
  Post, 
  Get, 
  Param, 
  Body, 
  UploadedFile, 
  UseGuards, 
  Req, 
  UseInterceptors, 
  BadRequestException 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EnrollmentsService } from './enrollments.service.js';
import { EnrollDto } from './dto/enroll.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { GlobalRole } from '@prisma/client';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  // التسجيل في برنامج أو دفعة مع رفع إيصال الدفع والبيانات الشخصية
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.STUDENT, GlobalRole.SUPER_ADMIN)
  @Post(':programId')
  @UseInterceptors(
    FileInterceptor('receipt', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          callback(null, `receipt-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // الحد الأقصى 5 ميجابايت
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|pdf)$/)) {
          return callback(new BadRequestException('يسمح فقط برفع صور (JPG, PNG) أو ملفات PDF'), false);
        }
        callback(null, true);
      },
    }),
  )
  async enroll(
    @Param('programId') programId: string,
    @Req() req: any,
    @Body() dto: EnrollDto,
    @UploadedFile() receipt?: Express.Multer.File,
  ) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    return this.enrollmentsService.enrollStudent(userId, programId, dto, receipt);
  }

  // جلب دورات الطالب الحالية
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(GlobalRole.STUDENT, GlobalRole.SUPER_ADMIN)
  @Get('my-enrollments')
  async getMyEnrollments(@Req() req: any) {
    const userId = req.user.userId;
    return this.enrollmentsService.getStudentEnrollments(userId);
  }
}