import { Body, Controller, HttpCode, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { setAuthCookies } from '../core/cookie.util';
import { CurrentUser } from '../core/current-user.decorator';
import { JwtAuthGuard } from '../core/jwt-auth.guard';
import type { AuthUser } from '../core/jwt.strategy';
import { SocialLoginDto } from './dto/social-login.dto';
import { SocialAuthService } from './social-auth.service';

@ApiTags('auth')
@Controller('auth/social')
export class SocialAuthController {
  constructor(private readonly socialAuth: SocialAuthService) {}

  @Post(':provider')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async login(
    @Param('provider') provider: string,
    @Body() dto: SocialLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const meta = { userAgent: req.headers['user-agent'], ipAddress: req.ip };
    const tokens = await this.socialAuth.loginOrRegister(provider, dto.accessToken, meta);
    setAuthCookies(res, tokens, false);
    return { message: '소셜 로그인 성공' };
  }

  @Post('link/:provider')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async link(@Param('provider') provider: string, @Body() dto: SocialLoginDto, @CurrentUser() user: AuthUser) {
    await this.socialAuth.linkAccount(user.accountId, provider, dto.accessToken);
    return { message: '소셜 계정 연동이 완료되었습니다.' };
  }
}
