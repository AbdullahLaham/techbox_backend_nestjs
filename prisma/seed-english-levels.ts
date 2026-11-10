/**
 * Creates the English levels program: 12 tracks (Level 1 to Level 12), each with themed modules,
 * and in each module one published 10-question quiz. Run with `npm run seed:english-levels`.
 *
 * Kept apart from prisma/seed.ts on purpose: this script never touches accounts or passwords.
 *
 * Safe to run again: if the program's slug already exists nothing is changed, so enrollments and
 * quiz attempts are never lost. Everything is created in one transaction: all of it or nothing.
 * The content lives in prisma/seed-data/english-levels and is validated before the database is used.
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
import { level01 } from './seed-data/english-levels/level-01.js';
import { level02 } from './seed-data/english-levels/level-02.js';
import { level03 } from './seed-data/english-levels/level-03.js';
import { level04 } from './seed-data/english-levels/level-04.js';
import { level05 } from './seed-data/english-levels/level-05.js';
import { level06 } from './seed-data/english-levels/level-06.js';
import { level07 } from './seed-data/english-levels/level-07.js';
import { level08 } from './seed-data/english-levels/level-08.js';
import { level09 } from './seed-data/english-levels/level-09.js';
import { level10 } from './seed-data/english-levels/level-10.js';
import { level11 } from './seed-data/english-levels/level-11.js';
import { level12 } from './seed-data/english-levels/level-12.js';
import type {
  SeedLevel,
  SeedModule,
  SeedQuestion,
} from './seed-data/english-levels/types.js';

dotenv.config();

const PROGRAM = {
  title: 'مستويات اللغه الانجليزيه',
  slug: 'english-levels',
  description:
    'برنامج متكامل لتعلم اللغة الإنجليزية من الصفر حتى الإتقان، مقسم إلى 12 مستوى متدرجاً وفق الإطار الأوروبي المرجعي للغات (من A1 إلى C2). يضم كل مستوى ثلاث وحدات في القواعد والمفردات ومهارات اللغة، وتنتهي كل وحدة باختبار من 10 أسئلة مع شرح لكل إجابة.',
};

const LEVELS: SeedLevel[] = [
  level01,
  level02,
  level03,
  level04,
  level05,
  level06,
  level07,
  level08,
  level09,
  level10,
  level11,
  level12,
];

const EXPECTED_TRACKS = 12;
const QUESTIONS_PER_QUIZ = 10;
const PASSING_SCORE = 7; // Each question is worth 1 point, so 7 out of 10.
const MAX_ATTEMPTS = 3;

/** Every rule the admin API enforces on this content, so a bad entry stops the run before any write. */
function findProblems(levels: SeedLevel[]): string[] {
  const problems: string[] = [];
  const seenQuestions = new Set<string>();

  if (!SLUG_PATTERN.test(PROGRAM.slug))
    problems.push(`Invalid slug: ${PROGRAM.slug}`);
  if (PROGRAM.description.length > PROGRAM_LIMITS.descriptionMax)
    problems.push('Program description is too long');
  if (levels.length !== EXPECTED_TRACKS)
    problems.push(`Expected ${EXPECTED_TRACKS} levels, found ${levels.length}`);

  levels.forEach((level, levelIndex) => {
    if (level.title !== `Level ${levelIndex + 1}`)
      problems.push(`Level at position ${levelIndex + 1} is "${level.title}"`);
    if (level.description.length > PROGRAM_LIMITS.curriculumDescriptionMax)
      problems.push(`${level.title}: description too long`);
    if (level.modules.length === 0) problems.push(`${level.title}: no modules`);

    for (const module of level.modules) {
      const where = `${level.title} / ${module.title}`;
      if (`${module.title} — ${module.titleAr}`.length > NODE_LIMITS.titleMax)
        problems.push(`${where}: title too long`);
      if (module.description.length > PROGRAM_LIMITS.curriculumDescriptionMax)
        problems.push(`${where}: description too long`);
      if (module.questions.length !== QUESTIONS_PER_QUIZ)
        problems.push(`${where}: ${module.questions.length} questions`);

      for (const question of module.questions) {
        const options = [question.correct, ...question.wrong];
        const label = `${where}: "${question.text.slice(-60)}"`;
        if (seenQuestions.has(question.text))
          problems.push(`${label}: duplicate question`);
        seenQuestions.add(question.text);
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
  });
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
  const problems = findProblems(LEVELS);
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
      where: { slug: PROGRAM.slug },
      select: { id: true },
    });
    if (existing) {
      console.log(
        `- "${PROGRAM.title}" already exists (${PROGRAM.slug}); nothing was changed.`,
      );
      return;
    }

    const program = await prisma.$transaction(
      async (tx) => {
        const created = await tx.program.create({
          data: {
            ...PROGRAM,
            type: ProgramType.ACADEMIC_COURSE,
            status: ProgramStatus.PUBLISHED,
          },
        });
        for (const [trackIndex, level] of LEVELS.entries()) {
          await tx.track.create({
            data: {
              programId: created.id,
              title: level.title,
              description: level.description,
              orderIndex: trackIndex,
              modules: { create: level.modules.map(moduleData) },
            },
          });
          console.log(`- ${level.title}: ${level.modules.length} modules`);
        }
        return created;
      },
      { timeout: 300_000, maxWait: 30_000 },
    );

    const modules = LEVELS.reduce(
      (total, level) => total + level.modules.length,
      0,
    );
    console.log(
      `✅ "${program.title}" created (${program.id}): ${LEVELS.length} tracks, ${modules} modules, ${modules} quizzes, ${modules * QUESTIONS_PER_QUIZ} questions.`,
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
