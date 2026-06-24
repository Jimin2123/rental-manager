import { Body, Controller, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { clearAuthCookies, setAccessTokenCookie, setAuthCookies } from '../core/cookie.util';
import { CurrentUser } from '../core/current-user.decorator';
import { JwtAuthGuard } from '../core/jwt-auth.guard';
import type { AuthUser } from '../core/jwt.strategy';
import { SessionService } from '../session/session.service';
import { TokenService } from '../session/token.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SwitchOrgDto } from './dto/switch-org.dto';
import { EmailAuthService } from './email-auth.service';

@ApiTags('auth')
@Controller('auth')
export class EmailAuthController {
  constructor(
    private readonly emailAuth: EmailAuthService,
    private readonly sessionService: SessionService,
    private readonly tokenService: TokenService,
  ) {}

  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: process.env['NODE_ENV'] === 'production' ? 5 : 1000 } })
  async register(@Body() dto: RegisterDto) {
    await this.emailAuth.register(dto.email, dto.password);
    return { message: '가입 완료. 인증 이메일을 발송했습니다.' };
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: process.env['NODE_ENV'] === 'production' ? 5 : 1000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const account = await this.emailAuth.validateCredentials(dto.email, dto.password);
    const meta = { userAgent: req.headers['user-agent'], ipAddress: req.ip };
    const tokens = await this.emailAuth.issueTokens(
      account.id,
      account.userId,
      account.email,
      dto.rememberMe ?? false,
      meta,
    );
    setAuthCookies(res, tokens, dto.rememberMe ?? false);
    return { accountId: account.id, email: account.email, emailVerifiedAt: account.emailVerifiedAt };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response, @CurrentUser() user: AuthUser) {
    const raw = (req.cookies as Record<string, string>)?.['refresh_token'];
    if (raw) {
      const hash = this.tokenService.hashToken(raw);
      const session = await this.sessionService.findValidByHash(hash);
      if (session) await this.sessionService.revokeById(session.id, user.accountId);
    }
    clearAuthCookies(res);
    return { message: '로그아웃되었습니다.' };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = (req.cookies as Record<string, string>)?.['refresh_token'];
    if (!raw) throw new UnauthorizedException('Refresh token이 없습니다.');

    const meta = { userAgent: req.headers['user-agent'], ipAddress: req.ip };
    const result = await this.emailAuth.refreshSession(raw, meta);
    setAuthCookies(res, result, result.rememberMe);
    return { message: 'Token refreshed.' };
  }

  @Post('switch-org')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async switchOrg(
    @Body() dto: SwitchOrgDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const { accessToken } = await this.emailAuth.switchOrg(user.accountId, user.userId, user.email, dto.organizationId);
    setAccessTokenCookie(res, accessToken);
    return { message: 'Organization switched.' };
  }
}
