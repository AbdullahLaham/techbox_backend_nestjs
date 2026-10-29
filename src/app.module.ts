import { Module } from '@nestjs/common';
import { createObserveModule } from '@nestjs/observe';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ConfigModule } from '@nestjs/config';
import { ProgramsModule } from './programs/programs.module.js';
import { EnrollmentsModule } from './enrollments/enrollments.module.js';
// تم حذف استيراد الـ AssignmentsController المباشر من هنا
import { AssignmentsModule } from './assignments/assignments.module.js';
import { NodesModule } from './nodes/nodes.module.js';
import { QuizzesModule } from './quizzes/quizzes.module.js';
import { SubmissionsModule } from './submissions/submissions.module.js';
import { ProgressModule } from './progress/progress.service.js';
import { NotificationsModule } from './notifications/notifications.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule()

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AuthModule,
    PrismaModule,
    ProgramsModule,
    EnrollmentsModule,
    AssignmentsModule, // <--- الموديول كفيل بتسجيل الكنترولر والخدمة الخاصة به
    NodesModule,
    QuizzesModule,
    SubmissionsModule,
    ProgressModule,
    NotificationsModule,
  ],
  controllers: [AppController], // <--- اترك فقط الـ AppController هنا
  providers: [AppService],
})
export class AppModule {}