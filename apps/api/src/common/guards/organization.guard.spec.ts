import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { OrganizationGuard } from './organization.guard';

const makeContext = (user: Record<string, unknown>, handler = {}, cls = {}) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => handler,
    getClass: () => cls,
  }) as unknown as ExecutionContext;

describe('OrganizationGuard', () => {
  let guard: OrganizationGuard;
  let prisma: { organizationMember: { findUnique: jest.Mock } };
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(async () => {
    prisma = { organizationMember: { findUnique: jest.fn() } };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        OrganizationGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    guard = module.get(OrganizationGuard);
  });

  it('throws 401 when JWT has no organizationId', async () => {
    const ctx = makeContext({ accountId: 'a', userId: 'u', email: 'e@b.com' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('throws 403 when member not found in DB', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue(null);
    const ctx = makeContext({ accountId: 'a', userId: 'u', email: 'e@b.com', organizationId: 'org-1' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('throws 403 when member is inactive', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm-1', role: 'STAFF', isActive: false });
    const ctx = makeContext({ accountId: 'a', userId: 'u', email: 'e@b.com', organizationId: 'org-1' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('returns true and attaches orgContext when valid active member', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm-1', role: 'STAFF', isActive: true });
    const req: Record<string, unknown> = { user: { accountId: 'a', userId: 'u', email: 'e@b.com', organizationId: 'org-1' } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(req['orgContext']).toEqual({ organizationId: 'org-1', memberId: 'm-1', role: 'STAFF' });
  });

  it('throws 403 when @Roles requires OWNER but member is STAFF', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm-1', role: 'STAFF', isActive: true });
    reflector.getAllAndOverride.mockReturnValue(['OWNER', 'ADMIN']);
    const ctx = makeContext({ accountId: 'a', userId: 'u', email: 'e@b.com', organizationId: 'org-1' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });

  it('passes when @Roles requires OWNER and member is OWNER', async () => {
    prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm-1', role: 'OWNER', isActive: true });
    reflector.getAllAndOverride.mockReturnValue(['OWNER', 'ADMIN']);
    const req: Record<string, unknown> = { user: { accountId: 'a', userId: 'u', email: 'e@b.com', organizationId: 'org-1' } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });
});
