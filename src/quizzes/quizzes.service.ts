import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { apiError } from '../common/api-errors.js';
import { NodeAccessService } from '../nodes/node-access.service.js';
import { isStaff, type Viewer } from '../programs/program-mapping.js';
import type { MyQuizAttempt, QuizAttemptResult, QuizResultQuestion, StudentQuiz } from '../types/nodes.contract.js';
import {
  STUDENT_QUESTIONS_SELECT,
  forStudent,
  gradeQuiz,
  num,
  percentage,
  toStudentQuestions,
  toStudentSummary,
} from './quiz-logic.js';
import { SubmitQuizDto } from './dto/quiz.dto.js';

/** Learner quiz API (/v1/quizzes/**). Correct answers never leave this service before an attempt. */
@Injectable()
export class QuizzesService {
  private readonly logger = new Logger('Quizzes');

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: NodeAccessService,
  ) {}

  /** GET /v1/quizzes/:quizId: questions and options without correctness. */
  async getQuiz(viewer: Viewer, quizId: string): Promise<StudentQuiz> {
    const quiz = await this.visibleQuiz(viewer, quizId);
    const row = await this.prisma.quiz.findUniqueOrThrow({
      where: { id: quizId },
      select: {
        id: true,
        nodeId: true,
        title: true,
        description: true,
        passingScore: true,
        maxAttempts: true,
        questions: STUDENT_QUESTIONS_SELECT,
        attempts: {
          where: { studentId: viewer.id },
          orderBy: { submittedAt: 'desc' },
          select: { id: true, score: true, passed: true },
        },
      },
    });
    return { ...toStudentSummary(row, row.attempts), nodeId: quiz.nodeId, questions: toStudentQuestions(row.questions) };
  }

  /**
   * POST /v1/quizzes/:quizId/attempts. Grades against the stored answers and saves the
   * attempt with a frozen result. Staff get the graded result as a preview (not saved).
   */
  async submit(viewer: Viewer, quizId: string, dto: SubmitQuizDto): Promise<QuizAttemptResult> {
    const quiz = await this.visibleQuiz(viewer, quizId);
    const full = await this.prisma.quiz.findUniqueOrThrow({
      where: { id: quizId },
      select: {
        passingScore: true,
        maxAttempts: true,
        showCorrectAnswers: true,
        questions: {
          orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
          select: {
            id: true,
            text: true,
            explanation: true,
            points: true,
            options: { orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }], select: { id: true, text: true, isCorrect: true } },
          },
        },
      },
    });
    

    const answers = validateAnswers(full.questions, dto);
    const graded = gradeQuiz(full.questions, answers);
    const passed = graded.score.greaterThanOrEqualTo(full.passingScore);
    const answersJson = full.questions.map((q) => ({ questionId: q.id, optionId: answers.get(q.id) ?? null }));

    const result = (id: string | null, attemptNumber: number, submittedAt: Date, attemptsUsed: number): QuizAttemptResult => ({
      id,
      quizId,
      nodeId: quiz.nodeId,
      score: num(graded.score),
      totalScore: num(graded.total),
      passingScore: num(full.passingScore),
      percentage: percentage(graded.score, graded.total),
      passed,
      correctCount: graded.correctCount,
      questionCount: full.questions.length,
      attemptNumber,
      attemptsRemaining: full.maxAttempts === null ? null : Math.max(0, full.maxAttempts - attemptsUsed),
      showCorrectAnswers: full.showCorrectAnswers,
      submittedAt: submittedAt.toISOString(),
      questions: forStudent(graded.questions, full.showCorrectAnswers),
    });

    // Staff can try the quiz without creating attempts (which would lock it for editing).
    if (isStaff(viewer)) return result(null, 1, new Date(), 0);

    const attempt = await this.prisma.$transaction(async (tx) => {
      // One submit at a time per student and quiz, so maxAttempts cannot be exceeded.
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`quiz:${quizId}:${viewer.id}`}, 0))`;
      const used = await tx.quizAttempt.count({ where: { quizId, studentId: viewer.id } });
      if (full.maxAttempts !== null && used >= full.maxAttempts) {
        throw apiError('MAX_ATTEMPTS_REACHED', 'No attempts left for this quiz.');
      }
      const created = await tx.quizAttempt.create({
        data: {
          quizId,
          studentId: viewer.id,
          attemptNumber: used + 1,
          answers: answersJson,
          result: graded.questions as unknown as Prisma.InputJsonValue,
          score: graded.score,
          totalScore: graded.total,
          passingScore: full.passingScore,
          passed,
        },
        select: { id: true, attemptNumber: true, submittedAt: true },
      });
      if (passed) {
        // Passing a quiz completes its lesson in the learner's progress.
        await tx.progressLog.upsert({
          where: { userId_nodeId: { userId: viewer.id, nodeId: quiz.nodeId } },
          create: { userId: viewer.id, nodeId: quiz.nodeId, isCompleted: true, completionPct: 100 },
          update: { isCompleted: true, completionPct: 100 },
        });
      }
      return created;
    });

    this.logger.log(JSON.stringify({ userId: viewer.id, action: 'quiz.attempt', quizId, attemptId: attempt.id, passed }));
    return result(attempt.id, attempt.attemptNumber, attempt.submittedAt, attempt.attemptNumber);
  }

  /** GET /v1/quizzes/:quizId/attempts: the caller's own attempts, newest first. */
  async myAttempts(viewer: Viewer, quizId: string): Promise<MyQuizAttempt[]> {
    await this.visibleQuiz(viewer, quizId);
    const rows = await this.prisma.quizAttempt.findMany({
      where: { quizId, studentId: viewer.id },
      orderBy: { submittedAt: 'desc' },
      select: { id: true, attemptNumber: true, score: true, totalScore: true, passingScore: true, passed: true, submittedAt: true },
    });
    return rows.map((r) => ({
      id: r.id,
      attemptNumber: r.attemptNumber,
      score: num(r.score),
      totalScore: num(r.totalScore),
      passingScore: num(r.passingScore),
      percentage: percentage(r.score, r.totalScore),
      passed: r.passed,
      submittedAt: r.submittedAt.toISOString(),
    }));
  }

  /** GET /v1/quizzes/attempts/:attemptId: own attempts only (404 otherwise). */
  async attemptResult(viewer: Viewer, attemptId: string): Promise<QuizAttemptResult> {
    const row = await this.prisma.quizAttempt.findFirst({
      where: { id: attemptId, studentId: viewer.id },
      select: {
        id: true,
        quizId: true,
        attemptNumber: true,
        score: true,
        totalScore: true,
        passingScore: true,
        passed: true,
        submittedAt: true,
        result: true,
        quiz: {
          select: {
            nodeId: true,
            maxAttempts: true,
            showCorrectAnswers: true,
            _count: { select: { attempts: { where: { studentId: viewer.id } } } },
          },
        },
      },
    });
    if (!row) throw apiError('NOT_FOUND', 'Attempt not found.');
    // Still enrolled? Losing access to the program also hides past results.
    await this.access.assertLearnerAccess(row.quiz.nodeId, viewer);

    const questions = row.result as unknown as QuizResultQuestion[];
    const used = row.quiz._count.attempts;
    return {
      id: row.id,
      quizId: row.quizId,
      nodeId: row.quiz.nodeId,
      score: num(row.score),
      totalScore: num(row.totalScore),
      passingScore: num(row.passingScore),
      percentage: percentage(row.score, row.totalScore),
      passed: row.passed,
      correctCount: questions.filter((q) => q.isCorrect).length,
      questionCount: questions.length,
      attemptNumber: row.attemptNumber,
      attemptsRemaining: row.quiz.maxAttempts === null ? null : Math.max(0, row.quiz.maxAttempts - used),
      showCorrectAnswers: row.quiz.showCorrectAnswers,
      submittedAt: row.submittedAt.toISOString(),
      questions: forStudent(questions, row.quiz.showCorrectAnswers),
    };
  }

  /** The quiz exists, the caller may open its lesson, and it is published (staff also see drafts). */
  private async visibleQuiz(viewer: Viewer, quizId: string): Promise<{ nodeId: string }> {
    const quiz = await this.prisma.quiz.findUnique({ where: { id: quizId }, select: { nodeId: true, isPublished: true } });
    if (!quiz) throw apiError('NOT_FOUND', 'Quiz not found.');
    await this.access.assertLearnerAccess(quiz.nodeId, viewer);
    if (!quiz.isPublished && !isStaff(viewer)) throw apiError('NOT_FOUND', 'Quiz not found.');
    return quiz;
  }
}

/**
 * Every answer must name a question of this quiz (once) and, when not null, one of that
 * question's options. Missing questions count as unanswered.
 */
function validateAnswers(
  questions: Array<{ id: string; options: Array<{ id: string }> }>,
  dto: SubmitQuizDto,
): Map<string, string | null> {
  const optionsByQuestion = new Map(questions.map((q) => [q.id, new Set(q.options.map((o) => o.id))]));
  const answers = new Map<string, string | null>();
  dto.answers.forEach((a, i) => {
    const options = optionsByQuestion.get(a.questionId);
    if (!options) {
      throw apiError('VALIDATION_FAILED', 'Unknown question.', { [`answers.${i}.questionId`]: 'السؤال غير موجود في هذا الاختبار' });
    }
    if (answers.has(a.questionId)) {
      throw apiError('VALIDATION_FAILED', 'Question answered twice.', { [`answers.${i}.questionId`]: 'تمت الإجابة على السؤال مرتين' });
    }
    if (a.optionId !== null && !options.has(a.optionId)) {
      throw apiError('VALIDATION_FAILED', 'Unknown option.', { [`answers.${i}.optionId`]: 'الخيار لا يتبع هذا السؤال' });
    }
    answers.set(a.questionId, a.optionId);
  });
  return answers;
}
