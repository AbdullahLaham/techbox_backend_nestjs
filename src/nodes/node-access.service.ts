import { Injectable } from '@nestjs/common';
import { EnrollmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { apiError } from '../common/api-errors.js';
import { PUBLIC_DETAIL_STATUSES, isStaff, type Viewer } from '../programs/program-mapping.js';

export type LessonProgram = { id: string; title: string; slug: string };

/**
 * Who may open a lesson as a learner: staff, or a student with an ACTIVE or COMPLETED
 * enrollment in the lesson's program while the program is PUBLISHED, ONGOING or COMPLETED.
 * Everyone else gets 404 (not 403), so the lesson's existence is not revealed.
 */
@Injectable()
export class NodeAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertLearnerAccess(nodeId: string, viewer: Viewer): Promise<LessonProgram> {
    const node = await this.prisma.activityNode.findUnique({
      where: { id: nodeId },
      select: {
        module: {
          select: { track: { select: { program: { select: { id: true, title: true, slug: true, status: true } } } } },
        },
      },
    });
    const program = node?.module.track.program;
    if (!program) throw apiError('NOT_FOUND', 'Lesson not found.');
    if (isStaff(viewer)) return { id: program.id, title: program.title, slug: program.slug };

    if (PUBLIC_DETAIL_STATUSES.includes(program.status)) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { userId_programId: { userId: viewer.id, programId: program.id } },
        select: { status: true },
      });
      if (enrollment?.status === EnrollmentStatus.ACTIVE || enrollment?.status === EnrollmentStatus.COMPLETED) {
        return { id: program.id, title: program.title, slug: program.slug };
      }
    }
    throw apiError('NOT_FOUND', 'Lesson not found.');
  }
}
