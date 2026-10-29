/**
 * One-off: move payment receipts saved by the old enrollment code ("/uploads/<file>",
 * never served) into StorageService under enrollments/<id>/, so admins can open them.
 * Safe to run again: only rows that still point at /uploads/ are touched, and the old
 * file is deleted only after the row points at the new key.
 *
 *   npx tsx scripts/migrate-legacy-receipts.ts            # move
 *   npx tsx scripts/migrate-legacy-receipts.ts --dry-run  # only list
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { LocalStorageService } from '../src/storage/local-storage.service.js';
import { ENROLLMENT_RECEIPT_LIMITS } from '../src/types/api.contract.js';

const dryRun = process.argv.includes('--dry-run');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const storage = new LocalStorageService({ get: (key: string) => process.env[key] } as never);
const uploadsDir = resolve('uploads');

const rows = await prisma.enrollment.findMany({
  where: { paymentReceipt: { startsWith: '/uploads/' } },
  select: { id: true, paymentReceipt: true },
});
console.log(`${rows.length} legacy receipt(s)${dryRun ? ' (dry run)' : ''}`);

let moved = 0;
for (const row of rows) {
  const source = resolve(uploadsDir, basename(row.paymentReceipt!));
  const ext = extname(source).toLowerCase();
  const contentType = ENROLLMENT_RECEIPT_LIMITS.allowedTypes[ext];
  if (!contentType) {
    console.warn(`skip ${row.id}: unsupported extension ${ext}`);
    continue;
  }
  const body = await readFile(source).catch(() => null);
  if (!body) {
    console.warn(`skip ${row.id}: ${source} not found`);
    continue;
  }
  const key = `enrollments/${row.id}/receipt-${randomUUID()}${ext}`;
  console.log(`${row.id}: ${row.paymentReceipt} -> ${key}`);
  if (dryRun) continue;

  await storage.put(key, body);
  const { count } = await prisma.enrollment.updateMany({
    where: { id: row.id, paymentReceipt: row.paymentReceipt },
    data: { paymentReceipt: key },
  });
  if (count === 1) {
    await rm(source, { force: true });
    moved++;
  } else {
    await storage.delete(key); // the row changed meanwhile; keep it as it is
  }
}

console.log(`moved ${moved}`);
await prisma.$disconnect();
