import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { GlobalRole, UserStatus } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import * as bcrypt from 'bcrypt';

const DEFAULT_REFRESH_TTL_DAYS = 30;

/** Refresh tokens are opaque; only their SHA-256 is stored, so a DB leak can't be replayed. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isBlocked(status: UserStatus): boolean {
  return status === UserStatus.SUSPENDED || status === UserStatus.ARCHIVED;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('البريد الإلكتروني مستخدم بالفعل');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        status: 'ACTIVE', // <--- أضف هذا السطر لضمان تفعيل الحساب فور التسجيل
        profile: {
          create: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            bio: dto.bio,
          },
        },
      },
      select: {
        id: true,
        email: true,
        globalRole: true,
        createdAt: true,
      },
    });

    return {
      message: 'تم إنشاء الحساب بنجاح',
      user,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { profile: true },
    });

    if (!user) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('بيانات الدخول غير صحيحة');
    }

    // JwtStrategy rejects these accounts on every route, so don't hand them a session.
    if (isBlocked(user.status)) {
      throw new UnauthorizedException('الحساب غير نشط');
    }

    const tokens = await this.issueTokens(user);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        globalRole: user.globalRole,
        firstName: user.profile?.firstName,
        lastName: user.profile?.lastName,
        role: user.globalRole,
      },
    };
  }

  /**
   * Rotate a refresh token: the presented token is consumed and a new access/refresh pair
   * is returned. A token that was already used, revoked or expired gets 401.
   */
  async refresh(refreshToken: string) {
    const session = await this.prisma.userSession.findUnique({
      where: { refreshToken: hashToken(refreshToken) },
      include: { user: { select: { id: true, email: true, globalRole: true, status: true } } },
    });

    if (!session) {
      throw new UnauthorizedException('انتهت الجلسة، يرجى تسجيل الدخول مجدداً');
    }

    // Consume the token first; deleteMany avoids a throw if a concurrent request won the race.
    const { count } = await this.prisma.userSession.deleteMany({ where: { id: session.id } });
    if (count === 0 || session.expiresAt <= new Date() || isBlocked(session.user.status)) {
      throw new UnauthorizedException('انتهت الجلسة، يرجى تسجيل الدخول مجدداً');
    }

    return this.issueTokens(session.user, session.deviceInfo);
  }

  /** Revoke one session. Unknown tokens are ignored so logout is idempotent. */
  async logout(refreshToken: string) {
    await this.prisma.userSession.deleteMany({ where: { refreshToken: hashToken(refreshToken) } });
  }

  private async issueTokens(
    user: { id: string; email: string; globalRole: GlobalRole },
    deviceInfo?: string | null,
  ) {
    const payload = { sub: user.id, email: user.email, globalRole: user.globalRole };
    const accessToken = await this.jwtService.signAsync(payload);

    const ttlDays =
      Number(this.configService.get<string>('JWT_REFRESH_EXPIRATION_DAYS')) || DEFAULT_REFRESH_TTL_DAYS;
    const refreshToken = randomBytes(48).toString('base64url');

    await this.prisma.$transaction([
      this.prisma.userSession.create({
        data: {
          userId: user.id,
          refreshToken: hashToken(refreshToken),
          deviceInfo: deviceInfo ?? null,
          expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
        },
      }),
      // Sign-in and refresh both pass here: "last seen" for the admin users list.
      this.prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } }),
    ]);

    return { accessToken, refreshToken };
  }
}
