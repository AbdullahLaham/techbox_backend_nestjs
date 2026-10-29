import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { apiError } from '../common/api-errors.js';
import type { Viewer } from '../programs/program-mapping.js';
import type {
  AdminQuiz,
  AdminQuizAttemptDetail,
  AdminQuizAttemptList,
  AdminQuizAttemptListItem,
  QuizResultQuestion,
} from '../types/nodes.contract.js';
import { ADMIN_QUIZ_SELECT, num, percentage, publishProblem, toAdminQuiz } from './quiz-logic.js';
import {
  AdminQuizAttemptListQueryDto,
  CreateQuizQuestionDto,
  QuizOptionDto,
  UpdateQuizDto,
  UpdateQuizQuestionDto,
} from './dto/quiz.dto.js';

const ATTEMPT_LIST_SELECT = {
  id: true,
  attemptNumber: true,
  score: true,
  totalScore: true,
  passingScore: true,
  passed: true,
  submittedAt: true,
  student: { select: { id: true, email: true, profile: { select: { firstName: true, lastName: true, fullNameAr: true } } } },
} satisfies Prisma.QuizAttemptSelect;

type AttemptRow = Prisma.QuizAttemptGetPayload<{ select: typeof ATTEMPT_LIST_SELECT }>;

const hasAttempts = () =>
  apiError(
    'QUIZ_HAS_ATTEMPTS',
    'Students have attempted this quiz: questions, points, correct answers and passingScore are locked.',
  );

function checkOneCorrect(options: QuizOptionDto[] | undefined) {
  if (options && options.filter((o) => o.isCorrect).length !== 1) {
    throw apiError('VALIDATION_FAILED', 'Exactly one option must be correct.', {
      options: 'يجب تحديد إجابة صحيحة واحدة فقط',
    });
  }
}

/** Quiz content and attempt review for the dashboard (/v1/admin/quizzes/**). */
@Injectable()
export class AdminQuizzesService {
  private readonly logger = new Logger('QuizzesAdmin');

  constructor(private readonly prisma: PrismaService) {}

  async get(quizId: string): Promise<AdminQuiz> {
    const row = await this.prisma.quiz.findUnique({ where: { id: quizId }, select: ADMIN_QUIZ_SELECT });
    if (!row) throw apiError('NOT_FOUND', 'Quiz not found.');
    return toAdminQuiz(row);
  }

  async update(viewer: Viewer, quizId: string, dto: UpdateQuizDto): Promise<AdminQuiz> {
    const current = await this.lockState(quizId);
    if (current.attempts > 0 && dto.passingScore !== undefined && !current.passingScore.equals(dto.passingScore)) {
      throw hasAttempts();
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.quiz.update({
        where: { id: quizId },
        data: {
          title: dto.title,
          description: dto.description,
          passingScore: dto.passingScore,
          maxAttempts: dto.maxAttempts,
          showCorrectAnswers: dto.showCorrectAnswers,
          isPublished: dto.isPublished,
        },
      });
      await this.assertStillPublishable(tx, quizId);
    });
    this.audit(viewer, dto.isPublished === undefined ? 'quiz.update' : `quiz.${dto.isPublished ? 'publish' : 'unpublish'}`, quizId);
    return this.get(quizId);
  }

  async addQuestion(viewer: Viewer, quizId: string, dto: CreateQuizQuestionDto): Promise<AdminQuiz> {
    checkOneCorrect(dto.options);
    const current = await this.lockState(quizId);
    if (current.attempts > 0) throw hasAttempts();

    const orderIndex =
      dto.orderIndex ??
      (await this.prisma.quizQuestion
        .aggregate({ where: { quizId }, _max: { orderIndex: true } })
        .then((a) => (a._max.orderIndex === null ? 0 : a._max.orderIndex + 1)));

    const question = await this.prisma.quizQuestion.create({
      data: {
        quizId,
        text: dto.text,
        explanation: dto.explanation ?? null,
        points: dto.points ?? 1,
        orderIndex,
        options: { create: dto.options.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, orderIndex: i })) },
      },
      select: { id: true },
    });
    this.audit(viewer, 'quiz.question.create', quizId, { questionId: question.id });
    return this.get(quizId);
  }

  /** Options are updated in place by position, so option ids (and past answers) stay valid. */
  async updateQuestion(viewer: Viewer, questionId: string, dto: UpdateQuizQuestionDto): Promise<AdminQuiz> {
    checkOneCorrect(dto.options);
    const question = await this.prisma.quizQuestion.findUnique({
      where: { id: questionId },
      select: {
        quizId: true,
        points: true,
        options: { orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }], select: { id: true, isCorrect: true } },
        quiz: { select: { _count: { select: { attempts: true } } } },
      },
    });
    if (!question) throw apiError('NOT_FOUND', 'Question not found.');

    if (question.quiz._count.attempts > 0) {
      const pointsChanged = dto.points !== undefined && !question.points.equals(dto.points);
      const answerChanged =
        dto.options !== undefined &&
        (question.options.length !== dto.options.length ||
          question.options.some((o, i) => o.isCorrect !== dto.options![i].isCorrect));
      if (pointsChanged || answerChanged) throw hasAttempts();
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.quizQuestion.update({
        where: { id: questionId },
        data: { text: dto.text, explanation: dto.explanation, points: dto.points, orderIndex: dto.orderIndex },
      });
      if (dto.options) {
        if (question.options.length === dto.options.length) {
          await Promise.all(
            question.options.map((o, i) =>
              tx.quizOption.update({
                where: { id: o.id },
                data: { text: dto.options![i].text, isCorrect: dto.options![i].isCorrect, orderIndex: i },
              }),
            ),
          );
        } else {
          // Only possible without attempts (checked above): rebuild the 4 options.
          await tx.quizOption.deleteMany({ where: { questionId } });
          await tx.quizOption.createMany({
            data: dto.options.map((o, i) => ({ questionId, text: o.text, isCorrect: o.isCorrect, orderIndex: i })),
          });
        }
      }
      await this.assertStillPublishable(tx, question.quizId);
    });
    this.audit(viewer, 'quiz.question.update', question.quizId, { questionId });
    return this.get(question.quizId);
  }

  async removeQuestion(viewer: Viewer, questionId: string): Promise<AdminQuiz> {
    const question = await this.prisma.quizQuestion.findUnique({
      where: { id: questionId },
      select: { quizId: true, quiz: { select: { _count: { select: { attempts: true } } } } },
    });
    if (!question) throw apiError('NOT_FOUND', 'Question not found.');
    if (question.quiz._count.attempts > 0) throw hasAttempts();

    await this.prisma.$transaction(async (tx) => {
      await tx.quizQuestion.delete({ where: { id: questionId } });
      await this.assertStillPublishable(tx, question.quizId);
    });
    this.audit(viewer, 'quiz.question.delete', question.quizId, { questionId });
    return this.get(question.quizId);
  }

  /* -------------------------------- Attempts ------------------------------ */

  async attempts(quizId: string, query: AdminQuizAttemptListQueryDto): Promise<AdminQuizAttemptList> {
    await this.lockState(quizId);
    const where: Prisma.QuizAttemptWhereInput = { quizId, passed: query.passed, studentId: query.studentId };
    const [rows, total, stats] = await this.prisma.$transaction([
      this.prisma.quizAttempt.findMany({
        where,
        select: ATTEMPT_LIST_SELECT,
        orderBy: [{ submittedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.quizAttempt.count({ where }),
      this.prisma.$queryRaw<Array<{ attempts: number; students: number; passed_students: number; avg_pct: number | null }>>`
        SELECT count(*)::int AS attempts,
               count(DISTINCT "studentId")::int AS students,
               count(DISTINCT "studentId") FILTER (WHERE passed)::int AS passed_students,
               round((avg("score" / NULLIF("totalScore", 0)) * 100)::numeric, 1)::float AS avg_pct
        FROM "QuizAttempt" WHERE "quizId" = ${quizId}`,
    ]);
    const s = stats[0];
    return {
      items: rows.map(toAttemptItem),
      page: query.page,
      pageSize: query.pageSize,
      total,
      stats: { attempts: s.attempts, students: s.students, passedStudents: s.passed_students, averagePercentage: s.avg_pct },
    };
  }

  async attempt(attemptId: string): Promise<AdminQuizAttemptDetail> {
    const row = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      select: { ...ATTEMPT_LIST_SELECT, quizId: true, result: true },
    });
    if (!row) throw apiError('NOT_FOUND', 'Attempt not found.');
    return { ...toAttemptItem(row), quizId: row.quizId, questions: row.result as unknown as QuizResultQuestion[] };
  }

  /* -------------------------------- Helpers ------------------------------- */

  private async lockState(quizId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      select: { passingScore: true, _count: { select: { attempts: true } } },
    });
    if (!quiz) throw apiError('NOT_FOUND', 'Quiz not found.');
    return { passingScore: quiz.passingScore, attempts: quiz._count.attempts };
  }

  /** A published quiz must stay complete; the surrounding transaction rolls back otherwise. */
  private async assertStillPublishable(tx: Prisma.TransactionClient, quizId: string) {
    const quiz = await tx.quiz.findUniqueOrThrow({
      where: { id: quizId },
      select: {
        isPublished: true,
        passingScore: true,
        questions: { select: { points: true, options: { select: { isCorrect: true } } } },
      },
    });
    const problem = quiz.isPublished ? publishProblem(quiz) : null;
    if (problem) throw apiError('QUIZ_NOT_READY', problem);
  }

  private audit(viewer: Viewer, action: string, quizId: string, extra: Record<string, string> = {}) {
    this.logger.log(JSON.stringify({ userId: viewer.id, action, quizId, ...extra }));
  }
}

function toAttemptItem(row: AttemptRow): AdminQuizAttemptListItem {
  const p = row.student.profile;
  const name = p?.fullNameAr || [p?.firstName, p?.lastName].filter(Boolean).join(' ') || null;
  return {
    id: row.id,
    student: { id: row.student.id, email: row.student.email, name },
    attemptNumber: row.attemptNumber,
    score: num(row.score),
    totalScore: num(row.totalScore),
    passingScore: num(row.passingScore),
    percentage: percentage(row.score, row.totalScore),
    passed: row.passed,
    submittedAt: row.submittedAt.toISOString(),
  };
}
