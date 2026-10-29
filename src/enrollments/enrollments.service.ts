import { Inject, Injectable, Logger } from '@nestjs/common';
import { EnrollmentStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { PrismaService } from '../prisma/prisma.service.js';
import { STORAGE_SERVICE, type StorageService } from '../storage/storage.service.js';
import { apiError } from '../common/api-errors.js';
import { inspectUpload } from '../common/uploads.js';
import {
  ENROLLMENT_RECEIPT_LIMITS,
  ENROLLMENT_STATUSES,
  ENROLLMENT_STATUS_TRANSITIONS,
  SEAT_HOLDING_STATUSES,
  canApply,
  type AdminEnrollmentDetail,
  type AdminEnrollmentList,
  type AdminEnrollmentListItem,
  type EnrollmentStatus as ContractEnrollmentStatus,
  type MyEnrollment,
} from '../types/api.contract.js';
import {
  MY_ENROLLMENT_SELECT,
  enrollmentBlockReason,
  enrollmentCountsByProgram,
  seatsTaken,
  toMyEnrollmentRef,
  type Viewer,
} from '../programs/program-mapping.js';
import { EnrollDto } from './dto/enroll.dto.js';
import { AdminEnrollmentListQueryDto, UpdateEnrollmentStatusDto } from './dto/admin-enrollment.dto.js';

const RECEIPT_URL_TTL_SEC = 3600;

const MY_ENROLLMENT_WITH_PROGRAM = {
  ...MY_ENROLLMENT_SELECT,
  program: {
    select: {
      id: true,
      title: true,
      slug: true,
      type: true,
      status: true,
      coverImage: true,
      startDate: true,
      endDate: true,
    },
  },
} satisfies Prisma.EnrollmentSelect;

const ADMIN_LIST_SELECT = {
  id: true,
  status: true,
  progressPct: true,
  paymentReceipt: true,
  reviewNote: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
  program: { select: { id: true, title: true, slug: true, maxSeats: true } },
  user: {
    select: {
      id: true,
      email: true,
      profile: {
        select: {
          firstName: true,
          lastName: true,
          fullNameAr: true,
          fullNameEn: true,
          phoneWhatsApp: true,
          phoneNumber: true,
          age: true,
          nationalId: true,
          governorate: true,
        },
      },
    },
  },
} satisfies Prisma.EnrollmentSelect;

type AdminRow = Prisma.EnrollmentGetPayload<{ select: typeof ADMIN_LIST_SELECT }>;

/** Receipts saved before StorageService (served from nowhere); see scripts/migrate-legacy-receipts.ts. */
const isLegacyReceipt = (key: string) => key.startsWith('/uploads/');

@Injectable()
export class EnrollmentsService {
  private readonly logger = new Logger('Enrollments');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_SERVICE) private readonly storage: StorageService,
  ) {}

  /* ------------------------------- Student -------------------------------- */

  /**
   * POST /v1/enrollments/:programId. A new application, or a new attempt after
   * REJECTED / DROPPED (the same row goes back to PENDING).
   */
  async apply(userId: string, programId: string, dto: EnrollDto, receipt?: Express.Multer.File): Promise<MyEnrollment> {
    const file = receipt ? await inspectUpload(receipt, ENROLLMENT_RECEIPT_LIMITS.allowedTypes) : null;

    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_programId: { userId, programId } },
      select: { id: true, status: true, paymentReceipt: true },
    });
    if (existing && !canApply(existing.status)) {
      throw apiError('ALREADY_ENROLLED', 'You already have an application for this program.');
    }

    // Store the receipt first; it is removed again if the database write fails.
    const enrollmentId = existing?.id ?? randomUUID();
    const receiptKey = file ? `enrollments/${enrollmentId}/receipt-${randomUUID()}${file.ext}` : null;
    if (file && receiptKey) {
      await this.storage.put(receiptKey, receipt!.buffer, { contentType: file.mimeType });
    }

    let saved: Prisma.EnrollmentGetPayload<{ select: typeof MY_ENROLLMENT_WITH_PROGRAM }>;
    try {
      saved = await this.prisma.$transaction(async (tx) => {
        // Serialises applications to the same program, so two students cannot take the last seat.
        await tx.$queryRaw`SELECT id FROM "Program" WHERE id = ${programId} FOR UPDATE`;
        const program = await tx.program.findUnique({
          where: { id: programId },
          select: { status: true, isEnrollmentOpen: true, endDate: true, maxSeats: true },
        });
        if (!program || program.status === 'DRAFT') {
          throw apiError('NOT_FOUND', 'Program not found.');
        }
        const counts = (await enrollmentCountsByProgram(tx, [programId])).get(programId);
        const reason = enrollmentBlockReason(program, counts ? seatsTaken(counts) : 0);
        if (reason === 'FULL') throw apiError('PROGRAM_FULL', 'No seats left in this program.');
        if (reason) throw apiError('ENROLLMENT_CLOSED', 'Enrollment in this program is closed.');

        await this.fillProfile(tx, userId, dto);

        const data = {
          status: EnrollmentStatus.PENDING,
          paymentReceipt: receiptKey ?? existing?.paymentReceipt ?? null,
          reviewNote: null,
          reviewedAt: null,
        };
        return existing
          ? tx.enrollment.update({
              where: { id: existing.id, status: existing.status },
              data,
              select: MY_ENROLLMENT_WITH_PROGRAM,
            })
          : tx.enrollment.create({
              data: { id: enrollmentId, userId, programId, ...data },
              select: MY_ENROLLMENT_WITH_PROGRAM,
            });
      });
    } catch (error) {
      if (receiptKey) await this.deleteFile(receiptKey);
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2025'].includes(error.code)) {
        // A parallel request created or changed the same application.
        throw apiError('ALREADY_ENROLLED', 'You already have an application for this program.');
      }
      throw error;
    }

    if (receiptKey && existing?.paymentReceipt && existing.paymentReceipt !== receiptKey) {
      await this.deleteFile(existing.paymentReceipt);
    }
    this.logger.log(JSON.stringify({ userId, action: existing ? 'enrollment.reapply' : 'enrollment.apply', enrollmentId: saved.id }));
    return toMyEnrollment(saved);
  }

  /** GET /v1/enrollments/my-enrollments */
  async myEnrollments(userId: string): Promise<MyEnrollment[]> {
    const rows = await this.prisma.enrollment.findMany({
      where: { userId },
      select: MY_ENROLLMENT_WITH_PROGRAM,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toMyEnrollment);
  }

  /* -------------------------------- Admin --------------------------------- */

  async list(query: AdminEnrollmentListQueryDto): Promise<AdminEnrollmentList> {
    const base: Prisma.EnrollmentWhereInput = {
      ...(query.programId ? { programId: query.programId } : {}),
      ...(query.q ? { OR: searchConditions(query.q) } : {}),
    };
    const where: Prisma.EnrollmentWhereInput = { ...base, ...(query.status ? { status: query.status } : {}) };
    const [field, dir] = query.sort.startsWith('-')
      ? [query.sort.slice(1) as 'createdAt' | 'updatedAt', 'desc' as const]
      : [query.sort as 'createdAt' | 'updatedAt', 'asc' as const];

    const [rows, total, groups] = await this.prisma.$transaction([
      this.prisma.enrollment.findMany({
        where,
        select: ADMIN_LIST_SELECT,
        orderBy: [{ [field]: dir }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.enrollment.count({ where }),
      this.prisma.enrollment.groupBy({ by: ['status'], where: base, _count: { _all: true }, orderBy: { status: 'asc' } }),
    ]);

    const statusCounts = Object.fromEntries(ENROLLMENT_STATUSES.map((s) => [s, 0])) as Record<ContractEnrollmentStatus, number>;
    for (const g of groups) statusCounts[g.status] = (g._count as { _all: number })._all;

    return {
      items: rows.map(toAdminListItem),
      page: query.page,
      pageSize: query.pageSize,
      total,
      statusCounts,
    };
  }

  async detail(id: string): Promise<AdminEnrollmentDetail> {
    const row = await this.prisma.enrollment.findUnique({ where: { id }, select: ADMIN_LIST_SELECT });
    if (!row) throw apiError('NOT_FOUND', 'Enrollment not found.');
    return this.toAdminDetail(row);
  }

  /** PATCH /v1/admin/enrollments/:id/status (ENROLLMENT_STATUS_TRANSITIONS). */
  async changeStatus(viewer: Viewer, id: string, dto: UpdateEnrollmentStatusDto): Promise<AdminEnrollmentDetail> {
    const current = await this.prisma.enrollment.findUnique({
      where: { id },
      select: { status: true, programId: true },
    });
    if (!current) throw apiError('NOT_FOUND', 'Enrollment not found.');
    if (!ENROLLMENT_STATUS_TRANSITIONS[current.status].includes(dto.status)) {
      throw apiError('INVALID_STATUS_TRANSITION', `Cannot change an enrollment from ${current.status} to ${dto.status}.`);
    }

    const takesSeat =
      SEAT_HOLDING_STATUSES.includes(dto.status) && !SEAT_HOLDING_STATUSES.includes(current.status);

    await this.prisma.$transaction(async (tx) => {
      if (takesSeat) {
        await tx.$queryRaw`SELECT id FROM "Program" WHERE id = ${current.programId} FOR UPDATE`;
        const program = await tx.program.findUniqueOrThrow({
          where: { id: current.programId },
          select: { maxSeats: true },
        });
        const counts = (await enrollmentCountsByProgram(tx, [current.programId])).get(current.programId);
        if (program.maxSeats !== null && (counts ? seatsTaken(counts) : 0) >= program.maxSeats) {
          throw apiError('PROGRAM_FULL', 'No seats left in this program; raise maxSeats first.');
        }
      }
      // Conditional write: fails if someone else changed the status meanwhile.
      const { count } = await tx.enrollment.updateMany({
        where: { id, status: current.status },
        data: { status: dto.status, reviewNote: dto.note ?? null, reviewedAt: new Date() },
      });
      if (count === 0) {
        throw apiError('INVALID_STATUS_TRANSITION', 'The enrollment changed meanwhile; reload and retry.');
      }
    });

    this.logger.log(
      JSON.stringify({ userId: viewer.id, action: `enrollment.status.${dto.status.toLowerCase()}`, enrollmentId: id }),
    );
    return this.detail(id);
  }

  /* ------------------------------- Helpers -------------------------------- */

  /** Fills the profile fields the student has not given yet; existing values are kept. */
  private async fillProfile(tx: Prisma.TransactionClient, userId: string, dto: EnrollDto) {
    const profile = await tx.userProfile.findUnique({ where: { userId } });
    const fields = {
      fullNameEn: profile?.fullNameEn || dto.fullNameEn,
      fullNameAr: profile?.fullNameAr || dto.fullNameAr,
      age: profile?.age || dto.age,
      phoneWhatsApp: profile?.phoneWhatsApp || dto.phoneWhatsApp,
      nationalId: profile?.nationalId || dto.nationalId,
      governorate: profile?.governorate || dto.governorate,
    };
    if (profile) {
      await tx.userProfile.update({ where: { userId }, data: fields });
    } else {
      const [firstName, ...rest] = dto.fullNameEn.split(/\s+/);
      await tx.userProfile.create({ data: { userId, firstName, lastName: rest.join(' ') || firstName, ...fields } });
    }
  }

  private async toAdminDetail(row: AdminRow): Promise<AdminEnrollmentDetail> {
    const key = row.paymentReceipt;
    const receiptMimeType = key && !isLegacyReceipt(key)
      ? ENROLLMENT_RECEIPT_LIMITS.allowedTypes[extname(key).toLowerCase()] ?? 'application/octet-stream'
      : null;
    const receiptUrl =
      key && receiptMimeType
        ? await this.storage.getDownloadUrl(key, {
            fileName: `receipt${extname(key)}`,
            contentType: receiptMimeType,
            expiresInSec: RECEIPT_URL_TTL_SEC,
          })
        : null;
    const profile = row.user.profile;
    const item = toAdminListItem(row);
    return {
      ...item,
      user: {
        ...item.user,
        age: profile?.age ?? null,
        nationalId: profile?.nationalId ?? null,
        governorate: profile?.governorate ?? null,
        phoneNumber: profile?.phoneNumber ?? null,
      },
      receiptUrl,
      receiptMimeType,
      program: { ...item.program, maxSeats: row.program.maxSeats },
    };
  }

  private async deleteFile(key: string) {
    if (isLegacyReceipt(key)) return;
    try {
      await this.storage.delete(key);
    } catch (error) {
      this.logger.error(
        JSON.stringify({ event: 'storage.orphan', storageKey: key, error: error instanceof Error ? error.message : String(error) }),
      );
    }
  }
}

function searchConditions(q: string): Prisma.EnrollmentWhereInput[] {
  const contains = { contains: q, mode: 'insensitive' as const };
  return [
    { user: { email: contains } },
    { user: { profile: { firstName: contains } } },
    { user: { profile: { lastName: contains } } },
    { user: { profile: { fullNameAr: contains } } },
    { user: { profile: { fullNameEn: contains } } },
    { user: { profile: { phoneWhatsApp: contains } } },
    { user: { profile: { nationalId: contains } } },
  ];
}

function toMyEnrollment(row: Prisma.EnrollmentGetPayload<{ select: typeof MY_ENROLLMENT_WITH_PROGRAM }>): MyEnrollment {
  return {
    ...toMyEnrollmentRef(row),
    program: {
      id: row.program.id,
      title: row.program.title,
      slug: row.program.slug,
      type: row.program.type,
      status: row.program.status,
      coverImage: row.program.coverImage,
      startDate: row.program.startDate?.toISOString() ?? null,
      endDate: row.program.endDate?.toISOString() ?? null,
    },
  };
}

function toAdminListItem(row: AdminRow): AdminEnrollmentListItem {
  const profile = row.user.profile;
  return {
    id: row.id,
    status: row.status,
    progressPct: row.progressPct,
    hasReceipt: !!row.paymentReceipt,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    user: {
      id: row.user.id,
      email: row.user.email,
      firstName: profile?.firstName ?? null,
      lastName: profile?.lastName ?? null,
      fullNameAr: profile?.fullNameAr ?? null,
      fullNameEn: profile?.fullNameEn ?? null,
      phoneWhatsApp: profile?.phoneWhatsApp ?? null,
    },
    program: { id: row.program.id, title: row.program.title, slug: row.program.slug },
  };
}
