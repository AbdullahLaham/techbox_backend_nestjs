/**
 * Creates the platform's first accounts: the system owner (SUPER_ADMIN) and an incubator
 * manager. Run with `npx prisma db seed` (or `npm run seed`).
 *
 * Passwords are never written in code: set them in .env before running.
 *   SEED_OWNER_EMAIL       default abed@techbox.com
 *   SEED_OWNER_PASSWORD    required, at least 12 characters
 *   SEED_MANAGER_EMAIL     default admin@techbox.com
 *   SEED_MANAGER_PASSWORD  optional; without it the manager account is skipped
 *
 * Safe to run again: an existing account keeps its password and data; only its role and
 * status are restored (so a locked-out owner can be recovered). Set SEED_RESET_PASSWORDS=true
 * to also replace the passwords with the ones in .env.
 */
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

const MIN_PASSWORD_LENGTH = 12;

type SeedAccount = {
  label: string;
  email: string;
  password: string | undefined;
  required: boolean;
  role: GlobalRole;
  firstName: string;
  lastName: string;
};

const ACCOUNTS: SeedAccount[] = [
  {
    label: 'Owner',
    email: process.env.SEED_OWNER_EMAIL || 'abed@techbox.com',
    password: process.env.SEED_OWNER_PASSWORD,
    required: true,
    role: GlobalRole.SUPER_ADMIN,
    firstName: 'System',
    lastName: 'Owner',
  },
  {
    label: 'Manager',
    email: process.env.SEED_MANAGER_EMAIL || 'admin@techbox.com',
    password: process.env.SEED_MANAGER_PASSWORD,
    required: false,
    role: GlobalRole.INCUBATOR_MANAGER,
    firstName: 'Incubator',
    lastName: 'Manager',
  },
];

async function seedAccount(account: SeedAccount, resetPasswords: boolean) {
  const email = account.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        globalRole: account.role,
        status: UserStatus.ACTIVE,
        ...(resetPasswords && account.password ? { passwordHash: await bcrypt.hash(account.password, 10) } : {}),
      },
    });
    console.log(`- ${account.label}: ${email} (موجود، تم تأكيد الصلاحية${resetPasswords ? ' وتحديث كلمة المرور' : ''})`);
    return;
  }

  await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(account.password!, 10),
      globalRole: account.role,
      status: UserStatus.ACTIVE,
      profile: { create: { firstName: account.firstName, lastName: account.lastName } },
    },
  });
  console.log(`- ${account.label}: ${email} (تم الإنشاء)`);
}

async function main() {
  console.log('🌱 جاري إنشاء حسابات الإدارة الأساسية...');
  const resetPasswords = process.env.SEED_RESET_PASSWORDS === 'true';

  const problems: string[] = [];
  for (const a of ACCOUNTS) {
    if (!a.password && a.required) problems.push(`${a.label}: ضع كلمة المرور في .env (SEED_${a.label.toUpperCase()}_PASSWORD)`);
    if (a.password && a.password.length < MIN_PASSWORD_LENGTH) {
      problems.push(`${a.label}: كلمة المرور يجب ألا تقل عن ${MIN_PASSWORD_LENGTH} حرفاً`);
    }
  }
  if (problems.length) {
    console.error(`❌ لم تتم إضافة أي حساب:\n  ${problems.join('\n  ')}`);
    process.exitCode = 1;
    return;
  }

  for (const account of ACCOUNTS) {
    if (!account.password) {
      console.log(`- ${account.label}: تم التخطي (لا توجد كلمة مرور في .env)`);
      continue;
    }
    await seedAccount(account, resetPasswords);
  }
  // Passwords are never printed.
  console.log('✅ تمت العملية. سجّل الدخول بكلمات المرور الموجودة في .env');
}

main()
  .catch((e) => {
    console.error('❌ حدث خطأ أثناء إضافة البيانات الأولية:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
