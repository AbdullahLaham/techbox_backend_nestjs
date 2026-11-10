import { Controller, Get, Injectable, Module, Param, UseFilters, UseGuards } from '@nestjs/common';
import { EnrollmentStatus, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ApiExceptionFilter, apiError } from '../common/api-errors.js';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.js';
import type { CertificateVerification, MyCertificate, MyCertificates } from '../types/profile.contract.js';
import { newCertificateCode, normalizeCertificateCode } from './certificate-code.js';

export const REVOKED_REOPENED = 'ENROLLMENT_REOPENED';
export const REVOKED_ACCOUNT_DELETED = 'ACCOUNT_DELETED';

const CERTIFICATE_SELECT = {
  id: true,
  code: true,
  programId: true,
  programTitle: true,
  holderName: true,
  issuedAt: true,
  revokedAt: true,
} satisfies Prisma.CertificateSelect;

type CertificateRow = Prisma.CertificateGetPayload<{ select: typeof CERTIFICATE_SELECT }>;

/** Name printed on a certificate: Arabic full name, else English, else first + last name. */
export function holderNameOf(
  profile: { firstName: string; lastName: string; fullNameAr: string | null; fullNameEn: string | null } | null,
): string | null {
  if (!profile) return null;
  return profile.fullNameAr || profile.fullNameEn || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || null;
}

/**
 * Completion certificates (profile.contract.ts). They follow the enrollments without any
 * hook in the enrollment code: `sync` issues one for every COMPLETED enrollment, revokes it
 * when the enrollment is reopened, and restores it when it is completed again. It runs when
 * the student lists their certificates and when a code is verified, so existing COMPLETED
 * enrollments get theirs too.
 */
@Injectable()
export class CertificatesService {
  constructor(private readonly prisma: PrismaService) {}

  async sync(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
        profile: { select: { firstName: true, lastName: true, fullNameAr: true, fullNameEn: true } },
      },
    });
    // Deleted accounts keep their certificates revoked.
    if (!user || user.status === UserStatus.ARCHIVED) return;

    const rows = await this.prisma.enrollment.findMany({
      where: { userId, OR: [{ status: EnrollmentStatus.COMPLETED }, { certificate: { isNot: null } }] },
      select: {
        id: true,
        status: true,
        programId: true,
        reviewedAt: true,
        updatedAt: true,
        program: { select: { title: true } },
        certificate: { select: { id: true, revokedAt: true, revokeReason: true } },
      },
    });

    const completed = (r: (typeof rows)[number]) => r.status === EnrollmentStatus.COMPLETED;
    const toIssue = rows.filter((r) => completed(r) && !r.certificate);
    const toRevoke = rows.filter((r) => !completed(r) && r.certificate && !r.certificate.revokedAt);
    const toRestore = rows.filter(
      (r) => completed(r) && r.certificate?.revokedAt && r.certificate.revokeReason === REVOKED_REOPENED,
    );
    if (!toIssue.length && !toRevoke.length && !toRestore.length) return;

    const holderName = holderNameOf(user.profile);
    await this.prisma.$transaction([
      // skipDuplicates: a parallel sync may have issued the same one (enrollmentId is unique).
      this.prisma.certificate.createMany({
        data: toIssue.map((r) => ({
          code: newCertificateCode(),
          userId,
          programId: r.programId,
          enrollmentId: r.id,
          holderName,
          programTitle: r.program.title,
          issuedAt: r.reviewedAt ?? r.updatedAt,
        })),
        skipDuplicates: true,
      }),
      this.prisma.certificate.updateMany({
        where: { id: { in: toRevoke.map((r) => r.certificate!.id) }, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: REVOKED_REOPENED },
      }),
      this.prisma.certificate.updateMany({
        where: { id: { in: toRestore.map((r) => r.certificate!.id) }, revokeReason: REVOKED_REOPENED },
        data: { revokedAt: null, revokeReason: null },
      }),
    ]);
  }

  /** GET /v1/me/certificates */
  async mine(userId: string): Promise<MyCertificates> {
    await this.sync(userId);
    const rows = await this.prisma.certificate.findMany({
      where: { userId },
      select: CERTIFICATE_SELECT,
      orderBy: [{ issuedAt: 'desc' }, { id: 'asc' }],
    });
    return { items: rows.map(toMine) };
  }

  /** GET /v1/certificates/verify/:code (public). */
  async verify(input: string): Promise<CertificateVerification> {
    const code = normalizeCertificateCode(input);
    const found = code ? await this.prisma.certificate.findUnique({ where: { code }, select: { userId: true } }) : null;
    if (!code || !found) throw apiError('NOT_FOUND', 'Certificate not found.');

    await this.sync(found.userId); // reflects a reopened or re-completed enrollment
    const row = await this.prisma.certificate.findUniqueOrThrow({ where: { code }, select: CERTIFICATE_SELECT });
    return {
      code: row.code,
      status: row.revokedAt ? 'REVOKED' : 'VALID',
      holderName: row.holderName,
      programTitle: row.programTitle,
      issuedAt: row.issuedAt.toISOString(),
      revokedAt: row.revokedAt?.toISOString() ?? null,
    };
  }
}

function toMine(row: CertificateRow): MyCertificate {
  return {
    id: row.id,
    code: row.code,
    programId: row.programId,
    programTitle: row.programTitle,
    holderName: row.holderName,
    issuedAt: row.issuedAt.toISOString(),
    status: row.revokedAt ? 'REVOKED' : 'VALID',
  };
}

/** Public verification, for anyone shown a certificate code. Rate limited against guessing. */
@Controller('v1/certificates')
@UseFilters(ApiExceptionFilter)
@UseGuards(RateLimitGuard)
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Get('verify/:code')
  @RateLimit({ name: 'certificate-verify-ip', limit: 30, windowMs: 60_000, by: 'ip' })
  verify(@Param('code') code: string) {
    return this.certificates.verify(code);
  }
}

@Module({
  imports: [PrismaModule],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
