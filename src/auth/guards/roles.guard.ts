import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<GlobalRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true; // إذا لم يتم تحديد أدوار، المسار متاح لأي مستخدم مسجل دخول
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.globalRole) {
      return false;
    }

    // التحقق مما إذا كان دور المستخدم موجوداً ضمن الأدوار المسموحة
    return requiredRoles.includes(user.globalRole);
  }
}