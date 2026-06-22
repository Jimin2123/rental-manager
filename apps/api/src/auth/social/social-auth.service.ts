import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuthProvider } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { TokenService } from '../session/token.service';
import { GoogleProvider } from './providers/google.provider';
import { KakaoProvider } from './providers/kakao.provider';
import { NaverProvider } from './providers/naver.provider';
import type { ISocialProvider } from './providers/social-provider.interface';

const TTL_30D_MS = 30 * 24 * 60 * 60 * 1000;

interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class SocialAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly google: GoogleProvider,
    private readonly kakao: KakaoProvider,
    private readonly naver: NaverProvider,
  ) {}

  private resolveProvider(name: string): ISocialProvider {
    if (name === 'google') return this.google;
    if (name === 'kakao') return this.kakao;
    if (name === 'naver') return this.naver;
    throw new UnauthorizedException(`지원하지 않는 소셜 로그인 제공자입니다: ${name}`);
  }

  private toOAuthProvider(name: string): OAuthProvider {
    const upper = name.toUpperCase();
    if (upper === 'GOOGLE') return OAuthProvider.GOOGLE;
    if (upper === 'KAKAO') return OAuthProvider.KAKAO;
    if (upper === 'NAVER') return OAuthProvider.NAVER;
    throw new UnauthorizedException(`지원하지 않는 소셜 로그인 제공자입니다: ${name}`);
  }

  async loginOrRegister(providerName: string, accessToken: string, meta: SessionMeta) {
    const info = await this.resolveProvider(providerName).verify(accessToken);
    const provider = this.toOAuthProvider(providerName);

    const existing = await this.prisma.accountIdentity.findUnique({
      where: { provider_providerId: { provider, providerId: info.providerId } },
      include: { account: true },
    });

    if (existing) {
      const account = existing.account;
      if (!account.isActive) throw new UnauthorizedException('비활성화된 계정입니다.');
      return this.issueTokens(account.id, account.userId, account.email, meta);
    }

    if (!info.providerEmail) {
      throw new UnauthorizedException('소셜 계정에 이메일 정보가 없습니다. 이메일로 가입 후 연동해주세요.');
    }

    let accountId: string;
    let userId: string;
    let email: string;

    const byEmail = await this.prisma.account.findUnique({ where: { email: info.providerEmail } });
    if (byEmail) {
      accountId = byEmail.id;
      userId = byEmail.userId;
      email = byEmail.email;
      await this.prisma.accountIdentity.create({
        data: {
          accountId,
          provider,
          providerId: info.providerId,
          providerEmail: info.providerEmail,
          providerData: info.providerData,
        },
      });
    } else {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({ data: { type: 'PERSONAL' } });
        const account = await tx.account.create({
          data: { userId: user.id, email: info.providerEmail!, emailVerifiedAt: new Date() },
        });
        await tx.accountIdentity.create({
          data: {
            accountId: account.id,
            provider,
            providerId: info.providerId,
            providerEmail: info.providerEmail,
            providerData: info.providerData,
          },
        });
        return { accountId: account.id, userId: user.id, email: account.email };
      });
      accountId = result.accountId;
      userId = result.userId;
      email = result.email;
    }

    return this.issueTokens(accountId, userId, email, meta);
  }

  async linkAccount(accountId: string, providerName: string, accessToken: string): Promise<void> {
    const info = await this.resolveProvider(providerName).verify(accessToken);
    const provider = this.toOAuthProvider(providerName);

    const existing = await this.prisma.accountIdentity.findUnique({
      where: { provider_providerId: { provider, providerId: info.providerId } },
    });
    if (existing) {
      throw new ConflictException('이미 연동된 소셜 계정입니다.');
    }

    await this.prisma.accountIdentity.create({
      data: {
        accountId,
        provider,
        providerId: info.providerId,
        providerEmail: info.providerEmail,
        providerData: info.providerData,
      },
    });
  }

  private async issueTokens(accountId: string, userId: string, email: string, meta: SessionMeta) {
    const accessToken = this.tokenService.generateAccessToken({ sub: accountId, userId, email });
    const refreshToken = this.tokenService.generateRawRefreshToken();
    const expiresAt = new Date(Date.now() + TTL_30D_MS);
    await this.sessionService.create(accountId, refreshToken, expiresAt, meta);
    return { accessToken, refreshToken };
  }
}
