import { Injectable, Logger } from '@nestjs/common';
import { EnrollmentStatus, GlobalRole, Prisma, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { apiError } from '../common/api-errors.js';
import type { Viewer } from '../programs/program-mapping.js';
import {
  GLOBAL_ROLES,
  canManageRole,
  type AdminUserDetail,
  type AdminUserList,
  type AdminUserListItem,
  type GlobalRole as ContractRole,
  type UserStatus as ContractStatus,
} from '../types/api.contract.js';
import {
  AdminUserListQueryDto,
  ChangeUserRoleDto,
  ChangeUserStatusDto,
  CreateUserDto,
  ResetUserPasswordDto,
  UpdateUserDto,
} from './dto/admin-user.dto.js';

const USER_SELECT = {
  id: true,
  email: true,
  globalRole: true,
  status: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
  profile: {
    select: {
      firstName: true,
      lastName: true,
      phoneNumber: true,
      avatarUrl: true,
      bio: true,
      fullNameAr: true,
      fullNameEn: true,
      phoneWhatsApp: true,
      governorate: true,
      age: true,
    },
  },
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

const BCRYPT_ROUNDS = 10;

/**
 * Staff and student accounts for the dashboard (/v1/admin/users). Rules:
 *  - SUPER_ADMIN manages every role; INCUBATOR_MANAGER manages INSTRUCTOR, MENTOR, STUDENT, GUEST
 *    (MANAGEABLE_ROLES in api.contract.ts).
 *  - Nobody changes their own role or status (CANNOT_MODIFY_SELF).
 *  - The last active SUPER_ADMIN cannot be demoted, suspended or archived (LAST_SUPER_ADMIN).
 *  - SUSPENDED / ARCHIVED and password resets revoke every session; JwtStrategy already
 *    rejects these statuses, so access ends on the next request.
 */
@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger('UsersAdmin');

  constructor(private readonly prisma: PrismaService) {}

  /* --------------------------------- Reads -------------------------------- */

  async list(actor: Viewer, query: AdminUserListQueryDto): Promise<AdminUserList> {
    const base: Prisma.UserWhereInput = query.q ? { OR: searchConditions(query.q) } : {};
    const where: Prisma.UserWhereInput = {
      ...base,
      ...(query.role ? { globalRole: query.role } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const desc = query.sort.startsWith('-');
    const field = query.sort.replace(/^-/, '') as 'createdAt' | 'email' | 'lastSeenAt';
    const orderBy: Prisma.UserOrderByWithRelationInput =
      field === 'lastSeenAt'
        ? { lastSeenAt: { sort: desc ? 'desc' : 'asc', nulls: 'last' } }
        : { [field]: desc ? 'desc' : 'asc' };

    const [rows, total, byRole, byStatus] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        orderBy: [orderBy, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.user.count({ where }),
      this.prisma.user.groupBy({ by: ['globalRole'], where: base, _count: { _all: true }, orderBy: { globalRole: 'asc' } }),
      this.prisma.user.groupBy({ by: ['status'], where: base, _count: { _all: true }, orderBy: { status: 'asc' } }),
    ]);

    const roleCounts = Object.fromEntries(GLOBAL_ROLES.map((r) => [r, 0])) as Record<ContractRole, number>;
    for (const g of byRole) roleCounts[g.globalRole] = (g._count as { _all: number })._all;
    const statusCounts = Object.fromEntries(Object.values(UserStatus).map((s) => [s, 0])) as Record<ContractStatus, number>;
    for (const g of byStatus) statusCounts[g.status] = (g._count as { _all: number })._all;

    return {
      items: rows.map((r) => toListItem(r, actor)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      roleCounts,
      statusCounts,
    };
  }

  async detail(actor: Viewer, id: string): Promise<AdminUserDetail> {
    const row = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!row) throw apiError('NOT_FOUND', 'User not found.');

    const [enrollments, activeEnrollments, submissions, quizAttempts, gradedSubmissions, activeSessions] =
      await this.prisma.$transaction([
        this.prisma.enrollment.count({ where: { userId: id } }),
        this.prisma.enrollment.count({ where: { userId: id, status: EnrollmentStatus.ACTIVE } }),
        this.prisma.submission.count({ where: { studentId: id } }),
        this.prisma.quizAttempt.count({ where: { studentId: id } }),
        this.prisma.submission.count({ where: { gradedBy: id } }),
        this.prisma.userSession.count({ where: { userId: id, expiresAt: { gt: new Date() } } }),
      ]);

    const p = row.profile;
    return {
      ...toListItem(row, actor),
      updatedAt: row.updatedAt.toISOString(),
      profile: {
        bio: p?.bio ?? null,
        fullNameAr: p?.fullNameAr ?? null,
        fullNameEn: p?.fullNameEn ?? null,
        phoneWhatsApp: p?.phoneWhatsApp ?? null,
        governorate: p?.governorate ?? null,
        age: p?.age ?? null,
      },
      activeSessions,
      stats: { enrollments, activeEnrollments, submissions, quizAttempts, gradedSubmissions },
    };
  }

  /* -------------------------------- Writes -------------------------------- */

  async create(actor: Viewer, dto: CreateUserDto): Promise<AdminUserDetail> {
    this.requireRole(actor, dto.role, 'create users with this role');
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.withUniqueChecks(() =>
      this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          globalRole: dto.role,
          status: UserStatus.ACTIVE,
          profile: { create: { firstName: dto.firstName, lastName: dto.lastName, phoneNumber: dto.phoneNumber ?? null } },
        },
        select: { id: true },
      }),
    );
    this.audit(actor, 'user.create', user.id, { role: dto.role });
    return this.detail(actor, user.id);
  }

  /** Profile fields; allowed on manageable users and on the caller's own account. */
  async update(actor: Viewer, id: string, dto: UpdateUserDto): Promise<AdminUserDetail> {
    const target = await this.findTarget(id);
    if (target.id !== actor.id) this.requireRole(actor, target.globalRole, 'edit this user');

    const profile = { firstName: dto.firstName, lastName: dto.lastName, phoneNumber: dto.phoneNumber };
    await this.withUniqueChecks(() =>
      this.prisma.user.update({
        where: { id },
        data: {
          profile: {
            upsert: {
              create: {
                firstName: dto.firstName ?? target.profile?.firstName ?? '',
                lastName: dto.lastName ?? target.profile?.lastName ?? '',
                phoneNumber: dto.phoneNumber ?? null,
              },
              update: profile,
            },
          },
        },
      }),
    );
    this.audit(actor, 'user.update', id);
    return this.detail(actor, id);
  }

  async changeRole(actor: Viewer, id: string, dto: ChangeUserRoleDto): Promise<AdminUserDetail> {
    const target = await this.findTarget(id);
    this.forbidSelf(actor, target.id);
    this.requireRole(actor, target.globalRole, 'change the role of this user');
    this.requireRole(actor, dto.role, 'assign this role');
    if (target.globalRole === dto.role) return this.detail(actor, id);

    await this.prisma.$transaction(async (tx) => {
      if (target.globalRole === GlobalRole.SUPER_ADMIN) await this.guardLastSuperAdmin(tx, target);
      await tx.user.update({ where: { id }, data: { globalRole: dto.role } });
    });
    this.audit(actor, 'user.role', id, { from: target.globalRole, to: dto.role });
    return this.detail(actor, id);
  }

  async changeStatus(actor: Viewer, id: string, dto: ChangeUserStatusDto): Promise<AdminUserDetail> {
    const target = await this.findTarget(id);
    this.forbidSelf(actor, target.id);
    this.requireRole(actor, target.globalRole, 'change the status of this user');
    if (target.status === dto.status) return this.detail(actor, id);

    const blocks = dto.status === UserStatus.SUSPENDED || dto.status === UserStatus.ARCHIVED;
    await this.prisma.$transaction(async (tx) => {
      if (blocks && target.globalRole === GlobalRole.SUPER_ADMIN) await this.guardLastSuperAdmin(tx, target);
      await tx.user.update({ where: { id }, data: { status: dto.status } });
      // Sign out everywhere: refresh tokens stop working; access tokens are already
      // refused by JwtStrategy for these statuses.
      if (blocks) await tx.userSession.deleteMany({ where: { userId: id } });
    });
    this.audit(actor, 'user.status', id, { from: target.status, to: dto.status });
    return this.detail(actor, id);
  }

  /** New password chosen by the admin; every session is revoked. */
  async resetPassword(actor: Viewer, id: string, dto: ResetUserPasswordDto): Promise<void> {
    const target = await this.findTarget(id);
    if (target.id !== actor.id) this.requireRole(actor, target.globalRole, 'reset the password of this user');
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { passwordHash } }),
      this.prisma.userSession.deleteMany({ where: { userId: id } }),
    ]);
    this.audit(actor, 'user.password_reset', id);
  }

  /* ------------------------------- Helpers -------------------------------- */

  private async findTarget(id: string) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, globalRole: true, status: true, profile: { select: { firstName: true, lastName: true } } },
    });
    if (!target) throw apiError('NOT_FOUND', 'User not found.');
    return target;
  }

  private requireRole(actor: Viewer, role: GlobalRole, action: string) {
    if (!canManageRole(actor.globalRole, role)) {
      throw apiError('FORBIDDEN', `Your role cannot ${action} (${role}).`);
    }
  }

  private forbidSelf(actor: Viewer, targetId: string) {
    if (actor.id === targetId) {
      throw apiError('CANNOT_MODIFY_SELF', 'You cannot change your own role or status.');
    }
  }

  /** Inside the write transaction, so two admins cannot remove the last two owners at once. */
  private async guardLastSuperAdmin(tx: Prisma.TransactionClient, target: { id: string; status: UserStatus }) {
    if (target.status !== UserStatus.ACTIVE) return;
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended('users:super-admins', 0))`;
    const others = await tx.user.count({
      where: { globalRole: GlobalRole.SUPER_ADMIN, status: UserStatus.ACTIVE, id: { not: target.id } },
    });
    if (others === 0) {
      throw apiError('LAST_SUPER_ADMIN', 'This is the last active SUPER_ADMIN.');
    }
  }

  private async withUniqueChecks<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = JSON.stringify(error.meta ?? {});
        if (target.includes('phoneNumber')) {
          throw apiError('PHONE_TAKEN', 'This phone number is used by another account.', { phoneNumber: 'رقم الهاتف مستخدم لحساب آخر' });
        }
        throw apiError('EMAIL_TAKEN', 'This email is used by another account.', { email: 'البريد الإلكتروني مستخدم لحساب آخر' });
      }
      throw error;
    }
  }

  private audit(actor: Viewer, action: string, userId: string, extra: Record<string, string> = {}) {
    // Never log passwords or tokens.
    this.logger.log(JSON.stringify({ actorId: actor.id, action, userId, ...extra }));
  }
}

function searchConditions(q: string): Prisma.UserWhereInput[] {
  const contains = { contains: q, mode: 'insensitive' as const };
  return [
    { email: contains },
    { profile: { firstName: contains } },
    { profile: { lastName: contains } },
    { profile: { fullNameAr: contains } },
    { profile: { fullNameEn: contains } },
    { profile: { phoneNumber: contains } },
    { profile: { phoneWhatsApp: contains } },
  ];
}

function toListItem(row: UserRow, actor: Viewer): AdminUserListItem {
  const p = row.profile;
  const fullName = [p?.firstName, p?.lastName].filter(Boolean).join(' ');
  return {
    id: row.id,
    email: row.email,
    globalRole: row.globalRole,
    status: row.status,
    firstName: p?.firstName ?? null,
    lastName: p?.lastName ?? null,
    displayName: p?.fullNameAr || fullName || row.email,
    phoneNumber: p?.phoneNumber ?? null,
    avatarUrl: p?.avatarUrl ?? null,
    createdAt: row.createdAt.toISOString(),
    lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
    canManage: row.id !== actor.id && canManageRole(actor.globalRole, row.globalRole),
  };
}
