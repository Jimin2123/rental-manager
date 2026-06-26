import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { CurrentUser } from '../../auth/core/current-user.decorator';
import type { AuthUser } from '../../auth/core/jwt.strategy';
import { setAuthCookies } from '../../auth/core/cookie.util';
import { SessionService } from '../../auth/session/session.service';
import { TokenService } from '../../auth/session/token.service';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { InvitationService } from './invitation.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { SignupAcceptDto } from './dto/signup-accept.dto';

@ApiTags('invitations')
@Controller()
export class InvitationController {
  constructor(
    private readonly invitationService: InvitationService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
  ) {}

  @Post('organizations/:id/invitations')
  @UseGuards(JwtAuthGuard, OrganizationGuard)
  @Roles('OWNER', 'ADMIN')
  async send(@Body() dto: CreateInvitationDto, @OrgCtx() ctx: OrgContext) {
    return this.invitationService.send(ctx.organizationId, ctx.memberId, dto);
  }

  @Get('organizations/:id/invitations')
  @UseGuards(JwtAuthGuard, OrganizationGuard)
  @Roles('OWNER', 'ADMIN')
  async listForAdmin(@OrgCtx() ctx: OrgContext) {
    return this.invitationService.listForAdmin(ctx.organizationId);
  }

  @Delete('organizations/:id/invitations/:invitationId')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, OrganizationGuard)
  @Roles('OWNER', 'ADMIN')
  async cancel(@Param('invitationId') invitationId: string, @OrgCtx() ctx: OrgContext) {
    return this.invitationService.cancel(ctx.organizationId, invitationId);
  }

  @Post('organizations/:id/invitations/:invitationId/resend')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, OrganizationGuard)
  @Roles('OWNER', 'ADMIN')
  async resend(@Param('invitationId') invitationId: string, @OrgCtx() ctx: OrgContext) {
    return this.invitationService.resend(ctx.organizationId, invitationId);
  }

  // 정적 경로 — `:token` / `:id` 파라미터 라우트보다 먼저 선언
  @Get('invitations/mine')
  @UseGuards(JwtAuthGuard)
  async listMine(@CurrentUser() user: AuthUser) {
    return this.invitationService.listMine(user.email ?? '');
  }

  @Post('invitations/mine/:id/accept')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async acceptMine(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.invitationService.acceptById(id, user.email ?? '', user.userId);
  }

  @Post('invitations/mine/:id/decline')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async declineMine(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.invitationService.declineById(id, user.email ?? '');
  }

  @Get('invitations/sent/recent')
  @UseGuards(JwtAuthGuard, OrganizationGuard)
  async sentRecent(@OrgCtx() ctx: OrgContext) {
    return this.invitationService.sentRecent(ctx.memberId);
  }

  // 파라미터 라우트
  @Get('invitations/:token')
  async getByToken(@Param('token') token: string) {
    return this.invitationService.getByToken(token);
  }

  @Post('invitations/:token/accept')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async accept(@Param('token') token: string, @CurrentUser() user: AuthUser) {
    return this.invitationService.accept(token, user.userId);
  }

  @Post('invitations/:token/decline')
  @HttpCode(200)
  async declineByToken(@Param('token') token: string) {
    return this.invitationService.declineByToken(token);
  }

  @Post('invitations/:token/signup-accept')
  @HttpCode(200)
  async signupAccept(
    @Param('token') token: string,
    @Body() dto: SignupAcceptDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { userId, accountId } = await this.invitationService.signupAccept(token, dto);
    const payload = { sub: accountId, userId, email: dto.email };
    const accessToken = this.tokenService.generateAccessToken(payload);
    const refreshToken = this.tokenService.generateRawRefreshToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.sessionService.create(accountId, refreshToken, expiresAt, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    setAuthCookies(res, { accessToken, refreshToken }, false);
    return { message: '가입 및 수락 완료' };
  }
}
