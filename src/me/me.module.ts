import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Module,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CertificatesModule } from '../certificates/certificates.module.js';
import { ApiExceptionFilter } from '../common/api-errors.js';
import { PrivateCacheInterceptor } from '../common/private-cache.interceptor.js';
import { RateLimit, RateLimitGuard } from '../common/rate-limit.js';
import { UploadRateLimitGuard } from '../common/uploads.js';
import { HomeQueryDto } from '../home/home.dto.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { AVATAR_LIMITS } from '../types/profile.contract.js';
import { ChangePasswordDto, DeleteAccountDto, UpdateMyProfileDto } from './me.dto.js';
import { MeService } from './me.service.js';

const MIN = 60_000;

/** The signed-in user's own account (types/profile.contract.ts). Any role; own data only. */
@Controller('v1/me')
@UseGuards(JwtAuthGuard)
@UseFilters(ApiExceptionFilter)
@UseInterceptors(PrivateCacheInterceptor)
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get('profile')
  profile(@Req() req: any) {
    return this.me.profile(req.user.id);
  }

  @Patch('profile')
  updateProfile(@Req() req: any, @Body() dto: UpdateMyProfileDto) {
    return this.me.updateProfile(req.user.id, dto);
  }

  @Post('avatar')
  @HttpCode(HttpStatus.OK)
  @UseGuards(UploadRateLimitGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: { fileSize: AVATAR_LIMITS.maxBytes, files: 1 },
      defParamCharset: 'utf8',
    } as Parameters<typeof FileInterceptor>[1]),
  )
  uploadAvatar(@Req() req: any, @UploadedFile() avatar?: Express.Multer.File) {
    return this.me.uploadAvatar(req.user.id, avatar);
  }

  @Delete('avatar')
  removeAvatar(@Req() req: any) {
    return this.me.removeAvatar(req.user.id);
  }

  /** Guessing the current password is limited per IP. */
  @Post('password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'password-change-ip', limit: 10, windowMs: 15 * MIN, by: 'ip' })
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.me.changePassword(req.user.id, dto);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  logoutAll(@Req() req: any) {
    return this.me.logoutAll(req.user.id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(RateLimitGuard)
  @RateLimit({ name: 'account-delete-ip', limit: 10, windowMs: 15 * MIN, by: 'ip' })
  deleteAccount(@Req() req: any, @Body() dto: DeleteAccountDto) {
    return this.me.deleteAccount(req.user.id, dto);
  }

  /** Same `tz` query as GET /v1/home. */
  @Get('achievements')
  achievements(@Req() req: any, @Query() query: HomeQueryDto) {
    return this.me.achievements(req.user.id, query.tz);
  }

  @Get('certificates')
  certificates(@Req() req: any) {
    return this.me.certificatesOf(req.user.id);
  }
}

/** ProgressService and ActivityService come from their global modules. */
@Module({
  imports: [PrismaModule, AuthModule, StorageModule, CertificatesModule],
  controllers: [MeController],
  providers: [MeService, UploadRateLimitGuard],
})
export class MeModule {}
