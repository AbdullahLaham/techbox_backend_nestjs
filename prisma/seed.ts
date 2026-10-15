// import { PrismaClient, GlobalRole, AccountStatus, SubmissionStatus } from '@prisma/client';
// import * as bcrypt from 'bcrypt';

// const prisma = new PrismaClient();

// async function main() {
//   console.log('🌱 Starting database seeding...');

//   // 1. Cleaning existing data to ensure idempotent seeding
//   await prisma.progressLog.deleteMany();
//   await prisma.submission.deleteMany();
//   await prisma.assignment.deleteMany();
//   await prisma.videoAsset.deleteMany();
//   await prisma.activityNode.deleteMany();
//   await prisma.module.deleteMany();
//   await prisma.enrollment.deleteMany();
//   await prisma.program.deleteMany();
//   await prisma.userSession.deleteMany();
//   await prisma.userProfile.deleteMany();
//   await prisma.user.deleteMany();

//   console.log('🧹 Cleaned previous database records.');

//   // 2. Hash default password for test accounts
//   const passwordHash = await bcrypt.hash('Password123!', 10);

//   // 3. Create Multi-role Users (Admin, Instructor, Student)
//   const adminUser = await prisma.user.create({
//     data: {
//       email: 'admin@techbox.edu',
//       passwordHash,
//       globalRole: GlobalRole.SUPER_ADMIN,
//       status: AccountStatus.ACTIVE,
//       profile: {
//         create: {
//           firstName: 'كامِل',
//           lastName: 'اللحام',
//           bio: 'مدير النظام ومسؤول حاضنة التكنولوجيا',
//         },
//       },
//     },
//   });

//   const instructorUser = await prisma.user.create({
//     data: {
//       email: 'instructor@techbox.edu',
//       passwordHash,
//       globalRole: GlobalRole.INSTRUCTOR,
//       status: AccountStatus.ACTIVE,
//       profile: {
//         create: {
//           firstName: 'أحمد',
//           lastName: 'منصور',
//           bio: 'خبير تطوير تطبيقات الموبايل والأنظمة الخلفية',
//         },
//       },
//     },
//   });

//   const studentUser = await prisma.user.create({
//     data: {
//       email: 'student@techbox.edu',
//       passwordHash,
//       globalRole: GlobalRole.STUDENT,
//       status: AccountStatus.ACTIVE,
//       profile: {
//         create: {
//           firstName: 'محمد',
//           lastName: 'علي',
//           bio: 'طالب في مسار تطوير الأنظمة الحاضنة',
//         },
//       },
//     },
//   });

//   console.log('👤 Created Users with Profile roles.');

//   // 4. Create Program & Curriculum Hierarchy
//   const program = await prisma.program.create({
//     data: {
//       title: 'دبلوم تطوير الأنظمة المتقدمة - NestJS & React Native',
//       slug: 'fullstack-incubator-diploma',
//       description: 'برنامج مكثف لبناء تطبيقات الموبايل والأنظمة الخلفية عالية الأداء.',
//       isPublished: true,
//       modules: {
//         create: [
//           {
//             title: 'الوحدة الأولى: هندسة Backend باستخدام NestJS & Prisma',
//             sortOrder: 1,
//             nodes: {
//               create: [
//                 {
//                   title: 'الدرس 1.1: مقدمة في بناء الأنظمة الموزعة',
//                   sortOrder: 1,
//                   video: {
//                     create: {
//                       externalId: 'bunny-vid-101-abcd',
//                       playbackUrl: 'https://iframe.mediadelivery.net/embed/123456/bunny-vid-101-abcd',
//                       durationSec: 1200, // 20 minutes
//                       resolution: '1080p',
//                     },
//                   },
//                 },
//                 {
//                   title: 'الواجب 1.1: تصميم نموذج البيانات وإنشاء الترحيلات (Migrations)',
//                   sortOrder: 2,
//                   assignment: {
//                     create: {
//                       instructions: 'قم بإنشاء مشروع NestJS مدمج مع Prisma وتطبيق الـ Migrations بنجاح.',
//                       dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // after 7 days
//                     },
//                   },
//                 },
//               ],
//             },
//           },
//         ],
//       },
//     },
//     include: {
//       modules: {
//         include: {
//           nodes: {
//             include: {
//               video: true,
//               assignment: true,
//             },
//           },
//         },
//       },
//     },
//   });

//   console.log('📚 Created Program, Modules, Video Assets, and Assignment Nodes.');

//   // Extract created nodes for relations
//   const firstModule = program.modules[0];
//   const videoNode = firstModule.nodes.find((n) => n.video !== null)!;
//   const assignmentNode = firstModule.nodes.find((n) => n.assignment !== null)!;

//   // 5. Enroll Student in Program
//   await prisma.enrollment.create({
//     data: {
//       userId: studentUser.id,
//       programId: program.id,
//       progressPct: 50.0,
//     },
//   });

//   // 6. Seed Progress Log (Video Telemetry Heartbeat)
//   await prisma.progressLog.create({
//     data: {
//       userId: studentUser.id,
//       nodeId: videoNode.id,
//       watchedSeconds: 1020, // Watched 17 mins out of 20
//       lastPositionSec: 1020,
//       completionPct: 85.0,
//       isCompleted: true,
//     },
//   });

//   console.log('📊 Seeded Video Progress Telemetry.');

//   // 7. Seed Student Submission & Instructor Grading
//   await prisma.submission.create({
//     data: {
//       assignmentId: assignmentNode.assignment!.id,
//       studentId: studentUser.id,
//       payload: {
//         repositoryUrl: 'https://github.com/student/incubator-lms-backend',
//         notes: 'تم إنهاء جميع المطلوب وتطبيق علاقات Prisma بشكل دقيق.',
//       },
//       status: SubmissionStatus.GRADED,
//       score: 95.50,
//       feedback: 'عمل ممتاز جداً ومطابق للمواصفات المطلوبة.',
//       gradedBy: instructorUser.id,
//     },
//   });

//   console.log('📝 Seeded Assignment Submissions and Grading Relation.');
//   console.log('✅ Seeding completed successfully!');
// }

// main()
//   .catch((e) => {
//     console.error('❌ Seeding failed:', e);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });








import { PrismaClient, GlobalRole, UserStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from 'pg';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

// إعداد اتصال الـ Driver Adapter الخاص بـ Prisma 7
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 جاري إنشاء حسابات الإدارة الأساسية...');

  const hashedPassword = await bcrypt.hash('abed12345', 10);

  // 1. إنشاء حساب مالك النظام (Super Admin / Owner)
  const owner = await prisma.user.upsert({
    where: { email: 'abed@techbox.com' },
    update: {},
    create: {
      email: 'abed@techbox.com',
      passwordHash: hashedPassword,
      globalRole: GlobalRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      profile: {
        create: {
          firstName: 'System',
          lastName: 'Owner',
          phoneNumber: '+970590000000',
        },
      },
    },
  });

  // 2. إنشاء حساب مدير الحاضنة (Incubator Manager / Admin)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@techbox.com' },
    update: {},
    create: {
      email: 'admin@techbox.com',
      passwordHash: hashedPassword,
      globalRole: GlobalRole.INCUBATOR_MANAGER,
      status: UserStatus.ACTIVE,
      profile: {
        create: {
          firstName: 'Incubator',
          lastName: 'Manager',
          phoneNumber: '+970591111111',
        },
      },
    },
  });

  console.log('✅ تم إنشاء الحسابات بنجاح:');
  console.log(`- Owner: ${owner.email} (كلمة المرور: abed12345)`);
  console.log(`- Admin: ${admin.email} (كلمة المرور: abed12345)`);
}

main()
  .catch((e) => {
    console.error('❌ حدث خطأ أثناء إضافة البيانات الأولية:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });