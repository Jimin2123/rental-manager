import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import type { OrgContext } from '../guards/organization.guard';

export const OrgCtx = createParamDecorator((_: unknown, ctx: ExecutionContext): OrgContext => {
  const req = ctx.switchToHttp().getRequest<Request & { orgContext: OrgContext }>();
  return req.orgContext;
});
