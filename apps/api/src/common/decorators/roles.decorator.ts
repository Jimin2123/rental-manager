import { SetMetadata } from '@nestjs/common';
import { OrganizationMemberRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: OrganizationMemberRole[]) => SetMetadata(ROLES_KEY, roles);
