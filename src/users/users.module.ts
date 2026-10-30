import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Module,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import { AuthModule } from '../auth/auth.module.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ApiExceptionFilter } from '../common/api-errors.js';
import { PrivateCacheInterceptor } from '../common/private-cache.interceptor.js';
import { USER_MANAGER_ROLES } from '../types/api.contract.js';
import { AdminUsersService } from './admin-users.service.js';
import {
  AdminUserListQueryDto,
  ChangeUserRoleDto,
  ChangeUserStatusDto,
  CreateUserDto,
  ResetUserPasswordDto,
  UpdateUserDto,
} from './dto/admin-user.dto.js';

/** User management for the dashboard (api-contract-users.md). */
@Controller('v1/admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...(USER_MANAGER_ROLES as readonly GlobalRole[]))
@UseFilters(ApiExceptionFilter)
@UseInterceptors(PrivateCacheInterceptor)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Req() req: any, @Query() query: AdminUserListQueryDto) {
    return this.users.list(req.user, query);
  }

  @Get(':id')
  detail(@Req() req: any, @Param('id') id: string) {
    return this.users.detail(req.user, id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateUserDto) {
    return this.users.create(req.user, dto);
  }

  @Patch(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(req.user, id, dto);
  }

  @Patch(':id/role')
  changeRole(@Req() req: any, @Param('id') id: string, @Body() dto: ChangeUserRoleDto) {
    return this.users.changeRole(req.user, id, dto);
  }

  @Patch(':id/status')
  changeStatus(@Req() req: any, @Param('id') id: string, @Body() dto: ChangeUserStatusDto) {
    return this.users.changeStatus(req.user, id, dto);
  }

  @Post(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPassword(@Req() req: any, @Param('id') id: string, @Body() dto: ResetUserPasswordDto) {
    return this.users.resetPassword(req.user, id, dto);
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
})
export class UsersModule {}
