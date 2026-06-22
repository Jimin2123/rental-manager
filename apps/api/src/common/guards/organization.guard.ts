import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationMemberRole } from '@prisma/client';
import { Request } from 'express';
import type { AuthUser } from '../../auth/core/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

export interface OrgContext {
  organizationId: string;
  memberId: string;
  role: OrganizationMemberRole;
}

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user: AuthUser; orgContext: OrgContext }>();
    const user = req.user;

    if (!user?.organizationId) {
      throw new UnauthorizedException('조직 컨텍스트가 없습니다. /auth/switch-org를 먼저 호출하세요.');
    }

    const member = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: user.userId, organizationId: user.organizationId } },
      select: { id: true, role: true, isActive: true },
    });

    if (!member || !member.isActive) {
      throw new ForbiddenException('해당 조직의 활성 멤버가 아닙니다.');
    }

    const requiredRoles = this.reflector.getAllAndOverride<OrganizationMemberRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles?.length && !requiredRoles.includes(member.role)) {
      throw new ForbiddenException('권한이 부족합니다.');
    }

    req.orgContext = { organizationId: user.organizationId, memberId: member.id, role: member.role };
    return true;
  }
}
