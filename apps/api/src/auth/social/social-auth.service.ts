import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuthProvider } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { MergeTokenPayload, TokenService } from '../session/token.service';
import { GoogleProvider } from './providers/google.provider';
import { KakaoProvider } from './providers/kakao.provider';
import { NaverProvider } from './providers/naver.provider';
import type { ISocialProvider, SocialUserInfo } from './providers/social-provider.interface';

const TTL_30D_MS = 30 * 24 * 60 * 60 * 1000;

interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
}

type LinkResult = { status: 'linked' | 'already_linked' } | { status: 'conflict'; sourceAccountId: string };

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

  getAuthorizationUrl(providerName: string, redirectUri: string, state: string): string {
    return this.resolveProvider(providerName).getAuthorizationUrl(redirectUri, state);
  }

  async getLinkedProviders(accountId: string) {
    const identities = await this.prisma.accountIdentity.findMany({
      where: { accountId },
      select: { provider: true, providerEmail: true },
    });
    return identities;
  }

  async linkAccountWithCode(
    accountId: string,
    providerName: string,
    code: string,
    redirectUri: string,
    state?: string,
  ): Promise<LinkResult> {
    const info = await this.resolveProvider(providerName).exchangeCode(code, redirectUri, state);
    const provider = this.toOAuthProvider(providerName);

    const existing = await this.prisma.accountIdentity.findUnique({
      where: { provider_providerId: { provider, providerId: info.providerId } },
    });
    if (existing) {
      if (existing.accountId === accountId) return { status: 'already_linked' };
      return { status: 'conflict', sourceAccountId: existing.accountId };
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
    return { status: 'linked' };
  }

  generateMergeToken(sourceAccountId: string, targetAccountId: string, provider: string): string {
    return this.tokenService.generateMergeToken({ type: 'account_merge', sourceAccountId, targetAccountId, provider });
  }

  verifyMergeToken(token: string): MergeTokenPayload {
    return this.tokenService.verifyMergeToken(token);
  }

  async mergeAccounts(sourceAccountId: string, targetAccountId: string): Promise<void> {
    const source = await this.prisma.account.findUniqueOrThrow({ where: { id: sourceAccountId } });
    const target = await this.prisma.account.findUniqueOrThrow({ where: { id: targetAccountId } });

    await this.prisma.$transaction(async (tx) => {
      // 1. AccountIdentity 이전 (target에 이미 있는 provider는 건너뜀)
      const sourceIdentities = await tx.accountIdentity.findMany({ where: { accountId: sourceAccountId } });
      const targetProviders = new Set(
        (await tx.accountIdentity.findMany({ where: { accountId: targetAccountId }, select: { provider: true } })).map(
          (i) => i.provider,
        ),
      );
      for (const identity of sourceIdentities) {
        if (!targetProviders.has(identity.provider)) {
          await tx.accountIdentity.update({ where: { id: identity.id }, data: { accountId: targetAccountId } });
        }
      }

      // 2. OrganizationMember 이전 (target 유저가 이미 같은 org에 있으면 건너뜀)
      const sourceMembers = await tx.organizationMember.findMany({ where: { userId: source.userId } });
      for (const member of sourceMembers) {
        const conflict = await tx.organizationMember.findUnique({
          where: { userId_organizationId: { userId: target.userId, organizationId: member.organizationId } },
        });
        if (!conflict) {
          await tx.organizationMember.update({ where: { id: member.id }, data: { userId: target.userId } });
        }
      }

      // 3. source 세션 무효화
      const now = new Date();
      await tx.refreshToken.updateMany({ where: { accountId: sourceAccountId }, data: { revokedAt: now } });

      // 4. source 계정 소프트 삭제 (email 해제 → 재가입 가능하도록)
      await tx.account.update({
        where: { id: sourceAccountId },
        data: { deletedAt: now, isActive: false, email: `deleted_${sourceAccountId}@merged.local` },
      });
      await tx.user.update({ where: { id: source.userId }, data: { deletedAt: now } });
    });
  }

  async getOrganizations(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId, isActive: true },
      include: { organization: { include: { businessProfile: true } } },
    });
    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.businessProfile.name,
      businessRegistrationNo: m.organization.businessProfile.businessRegistrationNo,
      role: m.role,
    }));
  }

  async loginOrRegister(providerName: string, accessToken: string, meta: SessionMeta) {
    const info = await this.resolveProvider(providerName).verify(accessToken);
    return this._processLogin(info, this.toOAuthProvider(providerName), meta);
  }

  async loginOrRegisterWithCode(
    providerName: string,
    code: string,
    redirectUri: string,
    meta: SessionMeta,
    state?: string,
  ) {
    const info = await this.resolveProvider(providerName).exchangeCode(code, redirectUri, state);
    return this._processLogin(info, this.toOAuthProvider(providerName), meta);
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

  private async _processLogin(info: SocialUserInfo, provider: OAuthProvider, meta: SessionMeta) {
    const existing = await this.prisma.accountIdentity.findUnique({
      where: { provider_providerId: { provider, providerId: info.providerId } },
      include: { account: true },
    });

    if (existing) {
      const account = existing.account;
      if (!account.isActive) throw new UnauthorizedException('비활성화된 계정입니다.');
      const tokens = await this.issueTokens(account.id, account.userId, account.email, meta);
      return { ...tokens, userId: account.userId };
    }

    if (!info.providerEmail) {
      throw new UnauthorizedException('소셜 계정에 이메일 정보가 없습니다. 이메일로 가입 후 연동해주세요.');
    }

    const { accountId, userId, email } = await this.prisma.$transaction(async (tx) => {
      // 트랜잭션 안에서 체크해야 TOCTOU 경쟁 조건 창을 최소화할 수 있음
      const emailTaken = await tx.account.findUnique({ where: { email: info.providerEmail! } });
      const user = await tx.user.create({ data: { type: 'PERSONAL' } });
      const account = await tx.account.create({
        data: {
          userId: user.id,
          // 같은 이메일을 가진 다른 계정이 있으면 null로 설정
          // 소셜 이메일은 AccountIdentity.providerEmail에 저장됨
          email: emailTaken ? null : info.providerEmail,
          emailVerifiedAt: emailTaken ? null : new Date(),
        },
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

    const tokens = await this.issueTokens(accountId, userId, email, meta);
    return { ...tokens, userId };
  }

  private async issueTokens(accountId: string, userId: string, email: string | null, meta: SessionMeta) {
    const accessToken = this.tokenService.generateAccessToken({ sub: accountId, userId, email });
    const refreshToken = this.tokenService.generateRawRefreshToken();
    const expiresAt = new Date(Date.now() + TTL_30D_MS);
    await this.sessionService.create(accountId, refreshToken, expiresAt, meta);
    return { accessToken, refreshToken };
  }
}
