import { Prisma } from '@prisma/client';
import type {
  AdminQuiz,
  AdminQuizSummary,
  QuizResultQuestion,
  StudentQuizQuestion,
  StudentQuizSummary,
} from '../types/nodes.contract.js';

const { Decimal } = Prisma;
type Decimal = Prisma.Decimal;

export const num = (d: Decimal) => d.toNumber();

/* -------------------------------- Selects -------------------------------- */

const byOrder = [{ orderIndex: 'asc' as const }, { id: 'asc' as const }];

/** Admin view: includes isCorrect. Never use it for student responses. */
export const ADMIN_QUIZ_SELECT = {
  id: true,
  nodeId: true,
  title: true,
  description: true,
  passingScore: true,
  maxAttempts: true,
  showCorrectAnswers: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { attempts: true } },
  questions: {
    orderBy: byOrder,
    select: {
      id: true,
      text: true,
      explanation: true,
      points: true,
      orderIndex: true,
      options: { orderBy: byOrder, select: { id: true, text: true, isCorrect: true, orderIndex: true } },
    },
  },
} satisfies Prisma.QuizSelect;

export type AdminQuizRow = Prisma.QuizGetPayload<{ select: typeof ADMIN_QUIZ_SELECT }>;

/** Student view of the questions: option ids and texts only. */
export const STUDENT_QUESTIONS_SELECT = {
  orderBy: byOrder,
  select: {
    id: true,
    text: true,
    points: true,
    orderIndex: true,
    options: { orderBy: byOrder, select: { id: true, text: true } },
  },
} satisfies Prisma.Quiz$questionsArgs;

/* -------------------------------- Mapping -------------------------------- */

export function totalOf(questions: Array<{ points: Decimal }>): Decimal {
  return questions.reduce((sum, q) => sum.plus(q.points), new Decimal(0));
}

export function percentage(score: Decimal, total: Decimal): number {
  return total.isZero() ? 0 : score.div(total).times(100).toDecimalPlaces(1).toNumber();
}

export function toAdminQuiz(row: AdminQuizRow): AdminQuiz {
  return {
    id: row.id,
    nodeId: row.nodeId,
    title: row.title,
    description: row.description,
    passingScore: num(row.passingScore),
    totalScore: num(totalOf(row.questions)),
    maxAttempts: row.maxAttempts,
    showCorrectAnswers: row.showCorrectAnswers,
    isPublished: row.isPublished,
    attemptsCount: row._count.attempts,
    isLocked: row._count.attempts > 0,
    questions: row.questions.map((q) => ({
      id: q.id,
      text: q.text,
      explanation: q.explanation,
      points: num(q.points),
      orderIndex: q.orderIndex,
      options: q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, orderIndex: o.orderIndex })),
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toAdminQuizSummary(quiz: {
  id: string;
  title: string;
  isPublished: boolean;
  passingScore: Decimal;
  questions: Array<{ points: Decimal }>;
  _count: { attempts: number };
}): AdminQuizSummary {
  return {
    id: quiz.id,
    title: quiz.title,
    isPublished: quiz.isPublished,
    questionCount: quiz.questions.length,
    totalScore: num(totalOf(quiz.questions)),
    passingScore: num(quiz.passingScore),
    attemptsCount: quiz._count.attempts,
  };
}

export function toStudentQuestions(
  questions: Array<{ id: string; text: string; points: Decimal; orderIndex: number; options: Array<{ id: string; text: string }> }>,
): StudentQuizQuestion[] {
  return questions.map((q) => ({
    id: q.id,
    text: q.text,
    points: num(q.points),
    orderIndex: q.orderIndex,
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
  }));
}

export function toStudentSummary(
  quiz: {
    id: string;
    title: string;
    description: string | null;
    passingScore: Decimal;
    maxAttempts: number | null;
    questions: Array<{ points: Decimal }>;
  },
  /** This student's attempts, newest first. */
  attempts: Array<{ id: string; score: Decimal; passed: boolean }>,
): StudentQuizSummary {
  const best = attempts.reduce<Decimal | null>((max, a) => (max === null || a.score.greaterThan(max) ? a.score : max), null);
  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    questionCount: quiz.questions.length,
    totalScore: num(totalOf(quiz.questions)),
    passingScore: num(quiz.passingScore),
    maxAttempts: quiz.maxAttempts,
    attemptsUsed: attempts.length,
    attemptsRemaining: quiz.maxAttempts === null ? null : Math.max(0, quiz.maxAttempts - attempts.length),
    bestScore: best === null ? null : num(best),
    passed: attempts.some((a) => a.passed),
    lastAttemptId: attempts[0]?.id ?? null,
  };
}

/* -------------------------------- Grading -------------------------------- */

export type GradableQuestion = {
  id: string;
  text: string;
  explanation: string | null;
  points: Decimal;
  options: Array<{ id: string; text: string; isCorrect: boolean }>;
};

export type GradeResult = {
  score: Decimal;
  total: Decimal;
  correctCount: number;
  questions: QuizResultQuestion[];
};

/**
 * Compares each answer with the stored correct option. A question scores its full points
 * when the selected option is the correct one, else 0. Unanswered questions score 0.
 * `answers` must already be validated (known question ids, options of that question).
 */
export function gradeQuiz(questions: GradableQuestion[], answers: Map<string, string | null>): GradeResult {
  let score = new Decimal(0);
  let correctCount = 0;
  const results = questions.map((q): QuizResultQuestion => {
    const selected = answers.get(q.id) ?? null;
    const correct = q.options.find((o) => o.isCorrect)?.id ?? null;
    const isCorrect = selected !== null && selected === correct;
    if (isCorrect) {
      score = score.plus(q.points);
      correctCount++;
    }
    return {
      questionId: q.id,
      text: q.text,
      points: num(q.points),
      pointsAwarded: isCorrect ? num(q.points) : 0,
      selectedOptionId: selected,
      isCorrect,
      correctOptionId: correct,
      explanation: q.explanation,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
    };
  });
  return { score, total: totalOf(questions), correctCount, questions: results };
}

/** Student copy of a stored result: hides correct answers and explanations when the quiz says so. */
export function forStudent(questions: QuizResultQuestion[], showCorrectAnswers: boolean): QuizResultQuestion[] {
  return showCorrectAnswers
    ? questions
    : questions.map((q) => ({ ...q, correctOptionId: null, explanation: null }));
}

/** Why a quiz cannot be published (or stay published), or null when it is complete. */
export function publishProblem(quiz: {
  passingScore: Decimal;
  questions: Array<{ points: Decimal; options: Array<{ isCorrect: boolean }> }>;
}): string | null {
  if (quiz.questions.length === 0) return 'The quiz has no questions.';
  if (quiz.questions.some((q) => q.options.length !== 4 || q.options.filter((o) => o.isCorrect).length !== 1)) {
    return 'Every question needs 4 options with exactly one correct.';
  }
  if (quiz.passingScore.greaterThan(totalOf(quiz.questions))) {
    return 'passingScore is higher than the total score of the questions.';
  }
  return null;
}
