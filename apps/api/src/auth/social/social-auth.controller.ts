import { randomUUID } from 'crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { setAuthCookies } from '../core/cookie.util';
import { CurrentUser } from '../core/current-user.decorator';
import { JwtAuthGuard } from '../core/jwt-auth.guard';
import type { AuthUser } from '../core/jwt.strategy';
import { MergeAccountDto } from './dto/merge-account.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { SocialAuthService } from './social-auth.service';

@ApiTags('auth')
@Controller('auth/social')
export class SocialAuthController {
  constructor(
    private readonly socialAuth: SocialAuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('merge')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async merge(@Body() dto: MergeAccountDto, @CurrentUser() user: AuthUser) {
    const payload = this.socialAuth.verifyMergeToken(dto.token);
    if (payload.type !== 'account_merge' || payload.targetAccountId !== user.accountId) {
      throw new UnauthorizedException('유효하지 않은 병합 토큰입니다.');
    }
    await this.socialAuth.mergeAccounts(payload.sourceAccountId, payload.targetAccountId);
    return { message: '계정이 병합되었습니다.' };
  }

  @Post(':provider')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: process.env['NODE_ENV'] === 'production' ? 5 : 1000 } })
  async login(
    @Param('provider') provider: string,
    @Body() dto: SocialLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const meta = { userAgent: req.headers['user-agent'], ipAddress: req.ip };
    const { userId, ...tokens } = await this.socialAuth.loginOrRegister(provider, dto.accessToken, meta);
    setAuthCookies(res, tokens, false);
    return this.socialAuth.getOrganizations(userId);
  }

  @Get(':provider/redirect')
  redirect(@Param('provider') provider: string, @Res() res: Response) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    try {
      const state = randomUUID();
      const redirectUri = `${frontendUrl}/auth/social/${provider}/callback`;
      const url = this.socialAuth.getAuthorizationUrl(provider, redirectUri, state);

      res.cookie('oauth_state', state, {
        httpOnly: true,
        maxAge: 5 * 60 * 1000,
        sameSite: 'lax',
        secure: process.env['NODE_ENV'] === 'production',
      });
      res.redirect(url);
    } catch {
      res.redirect(`${frontendUrl}/login?error=social`);
    }
  }

  @Get(':provider/callback')
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';

    if (error || !code) {
      return res.redirect(`${frontendUrl}/login?error=social`);
    }

    const storedState = (req.cookies as Record<string, string | undefined>)['oauth_state'];
    if (!state || !storedState || storedState !== state) {
      return res.redirect(`${frontendUrl}/login?error=social`);
    }

    const cookies = req.cookies as Record<string, string | undefined>;
    const linkAccountId = cookies['oauth_link_account'];
    res.clearCookie('oauth_state');

    const redirectUri = `${frontendUrl}/auth/social/${provider}/callback`;

    if (linkAccountId) {
      res.clearCookie('oauth_link_account');
      try {
        const result = await this.socialAuth.linkAccountWithCode(linkAccountId, provider, code, redirectUri, state);
        if (result.status === 'conflict') {
          const mergeToken = this.socialAuth.generateMergeToken(result.sourceAccountId, linkAccountId, provider);
          return res.redirect(`${frontendUrl}/settings/account?merge_token=${encodeURIComponent(mergeToken)}`);
        }
        return res.redirect(`${frontendUrl}/settings/account?success=linked`);
      } catch {
        return res.redirect(`${frontendUrl}/settings/account?error=link`);
      }
    }

    try {
      const meta = { userAgent: req.headers['user-agent'], ipAddress: req.ip };
      const { userId, ...tokens } = await this.socialAuth.loginOrRegisterWithCode(
        provider,
        code,
        redirectUri,
        meta,
        state,
      );
      const orgs = await this.socialAuth.getOrganizations(userId);
      setAuthCookies(res, tokens, false);
      return res.redirect(orgs.length > 0 ? `${frontendUrl}/` : `${frontendUrl}/setup`);
    } catch {
      return res.redirect(`${frontendUrl}/login?error=social`);
    }
  }

  @Get('identities')
  @UseGuards(JwtAuthGuard)
  async identities(@CurrentUser() user: AuthUser) {
    return this.socialAuth.getLinkedProviders(user.accountId);
  }

  @Get('link/:provider/redirect')
  @UseGuards(JwtAuthGuard)
  linkRedirect(@Param('provider') provider: string, @CurrentUser() user: AuthUser, @Res() res: Response) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    try {
      const state = randomUUID();
      const redirectUri = `${frontendUrl}/auth/social/${provider}/callback`;
      const url = this.socialAuth.getAuthorizationUrl(provider, redirectUri, state);
      const isProd = process.env['NODE_ENV'] === 'production';
      res.cookie('oauth_state', state, { httpOnly: true, maxAge: 5 * 60 * 1000, sameSite: 'lax', secure: isProd });
      res.cookie('oauth_link_account', user.accountId, {
        httpOnly: true,
        maxAge: 5 * 60 * 1000,
        sameSite: 'lax',
        secure: isProd,
      });
      res.redirect(url);
    } catch {
      res.redirect(`${frontendUrl}/settings/account?error=link`);
    }
  }

  @Post('link/:provider')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async link(@Param('provider') provider: string, @Body() dto: SocialLoginDto, @CurrentUser() user: AuthUser) {
    await this.socialAuth.linkAccount(user.accountId, provider, dto.accessToken);
    return { message: '소셜 계정 연동이 완료되었습니다.' };
  }
}
