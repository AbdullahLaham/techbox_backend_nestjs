import { Controller, Get, Module, Query, Req, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ApiExceptionFilter } from '../common/api-errors.js';
import { PrivateCacheInterceptor } from '../common/private-cache.interceptor.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { HomeQueryDto } from './home.dto.js';
import { HomeService } from './home.service.js';

/** The mobile Home tab in one request (types/home.contract.ts). Any signed-in user, own data only. */
@Controller('v1/home')
@UseGuards(JwtAuthGuard)
@UseFilters(ApiExceptionFilter)
@UseInterceptors(PrivateCacheInterceptor)
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get()
  get(@Req() req: any, @Query() query: HomeQueryDto) {
    return this.home.home(req.user.id, query.tz);
  }
}

/** ProgressService and NotificationsService come from their global modules. */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
