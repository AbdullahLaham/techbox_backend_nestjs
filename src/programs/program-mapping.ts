import { EnrollmentStatus, Prisma, ProgramStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  ENROLLMENT_STATUSES,
  SEAT_HOLDING_STATUSES,
  STAFF_ROLES,
  type AdminProgram,
  type EnrollmentBlockReason,
  type GlobalRole,
  type MyEnrollmentRef,
  type ProgramSummary,
} from '../types/api.contract.js';

/** The signed-in caller, as JwtStrategy puts it on `req.user`. */
export type Viewer = { id: string; globalRole: GlobalRole };

export const isStaff = (viewer?: Viewer) =>
  !!viewer && (STAFF_ROLES as readonly string[]).includes(viewer.globalRole);

/** Statuses listed in the public catalog. */
export const CATALOG_STATUSES: ProgramStatus[] = [ProgramStatus.PUBLISHED, ProgramStatus.ONGOING];
/** Statuses whose detail page is public (staff see every status). */
export const PUBLIC_DETAIL_STATUSES: ProgramStatus[] = [...CATALOG_STATUSES, ProgramStatus.COMPLETED];
/** Statuses that accept new applications. */
export const ENROLLABLE_STATUSES: ProgramStatus[] = [ProgramStatus.PUBLISHED, ProgramStatus.ONGOING];

export const PROGRAM_SELECT = {
  id: true,
  title: true,
  slug: true,
  description: true,
  type: true,
  status: true,
  coverImage: true,
  maxSeats: true,
  startDate: true,
  endDate: true,
  isEnrollmentOpen: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { tracks: true } },
} satisfies Prisma.ProgramSelect;

export type ProgramRow = Prisma.ProgramGetPayload<{ select: typeof PROGRAM_SELECT }>;
export type StatusCounts = Record<EnrollmentStatus, number>;

const emptyCounts = (): StatusCounts =>
  Object.fromEntries(ENROLLMENT_STATUSES.map((s) => [s, 0])) as StatusCounts;

/** Enrollment counts per status for several programs, in one grouped query. */
export async function enrollmentCountsByProgram(
  prisma: PrismaService | Prisma.TransactionClient,
  programIds: string[],
): Promise<Map<string, StatusCounts>> {
  const result = new Map<string, StatusCounts>();
  if (programIds.length === 0) return result;
  const groups = await prisma.enrollment.groupBy({
    by: ['programId', 'status'],
    where: { programId: { in: programIds } },
    _count: { _all: true },
  });
  for (const g of groups) {
    const counts = result.get(g.programId) ?? emptyCounts();
    counts[g.status] = g._count._all;
    result.set(g.programId, counts);
  }
  return result;
}

export function seatsTaken(counts: StatusCounts): number {
  return SEAT_HOLDING_STATUSES.reduce((sum, s) => sum + counts[s], 0);
}

/** Why a new application would be refused right now, or null when it would be accepted. */
export function enrollmentBlockReason(
  program: Pick<ProgramRow, 'status' | 'isEnrollmentOpen' | 'endDate' | 'maxSeats'>,
  taken: number,
  now = new Date(),
): EnrollmentBlockReason | null {
  if (!ENROLLABLE_STATUSES.includes(program.status)) return 'NOT_AVAILABLE';
  if (!program.isEnrollmentOpen) return 'CLOSED';
  if (program.endDate && program.endDate.getTime() < now.getTime()) return 'ENDED';
  if (program.maxSeats !== null && taken >= program.maxSeats) return 'FULL';
  return null;
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

export function toProgramSummary(row: ProgramRow, counts: StatusCounts = emptyCounts()): ProgramSummary {
  const taken = seatsTaken(counts);
  const reason = enrollmentBlockReason(row, taken);
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    type: row.type,
    status: row.status,
    coverImage: row.coverImage,
    startDate: iso(row.startDate),
    endDate: iso(row.endDate),
    isEnrollmentOpen: row.isEnrollmentOpen,
    seats: {
      max: row.maxSeats,
      taken,
      remaining: row.maxSeats === null ? null : Math.max(0, row.maxSeats - taken),
    },
    canEnroll: reason === null,
    enrollmentBlockReason: reason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    _count: {
      tracks: row._count.tracks,
      enrollments: counts.ACTIVE + counts.COMPLETED,
    },
  };
}

export function toAdminProgram(row: ProgramRow, counts: StatusCounts = emptyCounts()): AdminProgram {
  return { ...toProgramSummary(row, counts), maxSeats: row.maxSeats, enrollmentCounts: counts };
}

export const MY_ENROLLMENT_SELECT = {
  id: true,
  status: true,
  reviewNote: true,
  reviewedAt: true,
  paymentReceipt: true,
  progressPct: true,
  createdAt: true,
} satisfies Prisma.EnrollmentSelect;

export function toMyEnrollmentRef(
  row: Prisma.EnrollmentGetPayload<{ select: typeof MY_ENROLLMENT_SELECT }>,
): MyEnrollmentRef {
  return {
    id: row.id,
    status: row.status,
    reviewNote: row.reviewNote,
    reviewedAt: iso(row.reviewedAt),
    hasReceipt: !!row.paymentReceipt,
    progressPct: row.progressPct,
    createdAt: row.createdAt.toISOString(),
  };
}
