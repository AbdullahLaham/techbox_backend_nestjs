/**
 * Attaches the illustration of each English Levels assignment (prisma/seed-data/english-levels/
 * images) to its assignment, through the admin API so the file lands in the server's storage.
 * Run after `npm run seed:english-levels`, with a staff account that manages assignments
 * (SUPER_ADMIN, INCUBATOR_MANAGER or INSTRUCTOR):
 *
 *   API_URL=https://<api> ADMIN_EMAIL=<email> ADMIN_PASSWORD=<password> \
 *   npx tsx scripts/upload-english-assignment-images.ts
 *
 * Only the API is used (no database access). Safe to run again: assignments that already have
 * an attachment are skipped.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ASSIGNMENTS,
  ENGLISH_LEVELS_SLUG,
  assignmentNodeTitle,
  imageFileFor,
} from '../prisma/seed-data/english-levels/assignments.js';

const IMAGES_DIR = fileURLToPath(new URL('../prisma/seed-data/english-levels/images/', import.meta.url));
/** The API allows 20 uploads a minute per user. */
const PAUSE_MS = 3500;

type ListItem = { id: string; title: string; attachmentsCount: number };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`❌ ${name} is required (see the comment at the top of this file).`);
    process.exit(1);
  }
  return value;
}

async function json<T>(res: Response, what: string): Promise<T> {
  if (!res.ok) throw new Error(`${what} failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as T;
}

async function main() {
  const api = required('API_URL').replace(/\/$/, '');
  const email = required('ADMIN_EMAIL');
  const password = required('ADMIN_PASSWORD');

  const { accessToken } = await json<{ accessToken: string }>(
    await fetch(`${api}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }),
    'Sign-in',
  );
  const auth = { Authorization: `Bearer ${accessToken}` };

  const program = await json<{ id: string }>(
    await fetch(`${api}/v1/programs/${ENGLISH_LEVELS_SLUG}`, { headers: auth }),
    'Finding the program',
  );
  const list = await json<{ items: ListItem[] }>(
    await fetch(`${api}/v1/admin/assignments?programId=${program.id}&pageSize=100`, { headers: auth }),
    'Listing the assignments',
  );
  const byTitle = new Map(list.items.map((item) => [item.title, item]));

  let uploaded = 0;
  let skipped = 0;
  for (const a of ASSIGNMENTS) {
    const title = assignmentNodeTitle(a);
    const row = byTitle.get(title);
    if (!row) throw new Error(`Assignment not found: "${title}". Run the seed first.`);
    if (row.attachmentsCount > 0) {
      skipped++;
      continue;
    }

    const form = new FormData();
    const image = new Blob([readFileSync(IMAGES_DIR + imageFileFor(a))], { type: 'image/png' });
    form.append('file', image, `${a.title}.png`);
    const res = await fetch(`${api}/v1/admin/assignments/${row.id}/attachments`, {
      method: 'POST',
      headers: auth,
      body: form,
    });
    if (!res.ok) throw new Error(`Upload failed for "${title}" (${res.status}): ${await res.text()}`);
    uploaded++;
    console.log(`- Level ${a.level}: ${a.title}`);
    await sleep(PAUSE_MS);
  }
  console.log(`✅ ${uploaded} images uploaded, ${skipped} assignments already had one.`);
}

main().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
