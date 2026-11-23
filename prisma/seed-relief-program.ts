/**
 * Creates the employment programme on relief project management and humanitarian operations:
 * 3 tracks, 2 modules each, and one published 6-question quiz per module.
 * Run with `npm run seed:relief-program`.
 *
 * Never touches accounts or passwords. Safe to run again: if the programme's slug already exists
 * nothing is changed. Everything is created in one transaction: all of it or nothing. The content
 * (prisma/seed-data/relief-program) is validated before the database is used.
 */
import {
  NodeType,
  PrismaClient,
  ProgramStatus,
  ProgramType,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pkg from 'pg';
import * as dotenv from 'dotenv';
import { PROGRAM_LIMITS, SLUG_PATTERN } from '../src/types/api.contract.js';
import { NODE_LIMITS, QUIZ_LIMITS } from '../src/types/nodes.contract.js';
import type {
  SeedModule,
  SeedQuestion,
} from './seed-data/english-levels/types.js';
import {
  RELIEF_PROGRAM,
  RELIEF_TRACKS,
} from './seed-data/relief-program/content.js';

dotenv.config();

const QUESTIONS_PER_QUIZ = 6;
const PASSING_SCORE = 4; // Each question is worth 1 point, so 4 out of 6.
const MAX_ATTEMPTS = 3;

/** Every rule the admin API enforces on this content, so a bad entry stops the run before any write. */
function findProblems(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  if (!SLUG_PATTERN.test(RELIEF_PROGRAM.slug))
    problems.push(`Invalid slug: ${RELIEF_PROGRAM.slug}`);
  if (RELIEF_PROGRAM.title.length > PROGRAM_LIMITS.titleMax)
    problems.push('Program title is too long');
  if (RELIEF_PROGRAM.description.length > PROGRAM_LIMITS.descriptionMax)
    problems.push('Program description is too long');

  for (const track of RELIEF_TRACKS) {
    if (track.description.length > PROGRAM_LIMITS.curriculumDescriptionMax)
      problems.push(`${track.title}: description too long`);
    if (track.modules.length === 0) problems.push(`${track.title}: no modules`);
    for (const module of track.modules) {
      const where = `${track.title} / ${module.title}`;
      if (`${module.title} — ${module.titleAr}`.length > NODE_LIMITS.titleMax)
        problems.push(`${where}: title too long`);
      if (module.description.length > PROGRAM_LIMITS.curriculumDescriptionMax)
        problems.push(`${where}: description too long`);
      if (module.questions.length !== QUESTIONS_PER_QUIZ)
        problems.push(`${where}: ${module.questions.length} questions`);
      for (const question of module.questions) {
        const options = [question.correct, ...question.wrong];
        const label = `${where}: "${question.text.slice(0, 60)}"`;
        if (seen.has(question.text))
          problems.push(`${label}: duplicate question`);
        seen.add(question.text);
        if (question.text.length > QUIZ_LIMITS.questionTextMax)
          problems.push(`${label}: question too long`);
        if (!question.explanation.trim())
          problems.push(`${label}: no explanation`);
        if (question.explanation.length > QUIZ_LIMITS.explanationMax)
          problems.push(`${label}: explanation too long`);
        if (options.length !== QUIZ_LIMITS.optionsPerQuestion)
          problems.push(`${label}: needs 4 options`);
        if (
          options.some((o) => !o.trim() || o.length > QUIZ_LIMITS.optionTextMax)
        )
          problems.push(`${label}: bad option text`);
        if (
          new Set(options.map((o) => o.trim().toLowerCase())).size !==
          options.length
        )
          problems.push(`${label}: repeated option`);
      }
    }
  }
  return problems;
}

/** Same result on every run (seeded by the question text), so the correct answer has no fixed position. */
function shuffledOptions(question: SeedQuestion) {
  let seed = 2166136261;
  for (const char of question.text)
    seed = Math.imul(seed ^ char.codePointAt(0)!, 16777619);
  const random = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const options = [
    { text: question.correct, isCorrect: true },
    ...question.wrong.map((text) => ({ text, isCorrect: false })),
  ];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options.map((option, orderIndex) => ({ ...option, orderIndex }));
}

function moduleData(module: SeedModule, orderIndex: number) {
  return {
    title: `${module.title} — ${module.titleAr}`,
    description: module.description,
    orderIndex,
    nodes: {
      create: {
        title: `اختبار: ${module.titleAr}`,
        description: `اختبار قصير يقيس فهمك لموضوع ${module.titleAr}.`,
        type: NodeType.QUIZ,
        orderIndex: 0,
        isMandatory: true,
        quiz: {
          create: {
            title: `Quiz: ${module.title}`,
            description: `يتكون الاختبار من ${QUESTIONS_PER_QUIZ} أسئلة اختيار من متعدد، لكل سؤال درجة واحدة. علامة النجاح ${PASSING_SCORE} من ${QUESTIONS_PER_QUIZ}، ولديك ${MAX_ATTEMPTS} محاولات. يظهر شرح الإجابات بعد التسليم.`,
            passingScore: PASSING_SCORE,
            maxAttempts: MAX_ATTEMPTS,
            showCorrectAnswers: true,
            isPublished: true,
            questions: {
              create: module.questions.map((question, questionIndex) => ({
                text: question.text,
                explanation: question.explanation,
                points: 1,
                orderIndex: questionIndex,
                options: { create: shuffledOptions(question) },
              })),
            },
          },
        },
      },
    },
  };
}

async function main() {
  const problems = findProblems();
  if (problems.length) {
    console.error(
      `❌ The content has ${problems.length} problem(s); nothing was written:\n  ${problems.join('\n  ')}`,
    );
    process.exitCode = 1;
    return;
  }

  const pool = new pkg.Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const existing = await prisma.program.findUnique({
      where: { slug: RELIEF_PROGRAM.slug },
      select: { id: true },
    });
    if (existing) {
      console.log(
        `- "${RELIEF_PROGRAM.title}" already exists (${RELIEF_PROGRAM.slug}); nothing was changed.`,
      );
      return;
    }

    const program = await prisma.$transaction(
      async (tx) => {
        const created = await tx.program.create({
          data: {
            ...RELIEF_PROGRAM,
            type: ProgramType.BOOTCAMP,
            status: ProgramStatus.PUBLISHED,
          },
        });
        for (const [trackIndex, track] of RELIEF_TRACKS.entries()) {
          await tx.track.create({
            data: {
              programId: created.id,
              title: track.title,
              description: track.description,
              orderIndex: trackIndex,
              modules: { create: track.modules.map(moduleData) },
            },
          });
          console.log(`- ${track.title}: ${track.modules.length} modules`);
        }
        return created;
      },
      { timeout: 300_000, maxWait: 30_000 },
    );

    const modules = RELIEF_TRACKS.reduce(
      (total, track) => total + track.modules.length,
      0,
    );
    console.log(
      `✅ "${program.title}" created (${program.id}): ${RELIEF_TRACKS.length} tracks, ${modules} modules, ${modules} quizzes, ${modules * QUESTIONS_PER_QUIZ} questions.`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('❌ The seed failed; nothing was saved:', e);
  process.exitCode = 1;
});
