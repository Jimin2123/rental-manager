import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IMailService } from '../../mail/mail.interface';
import { MAIL_SERVICE } from '../../mail/mail.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../session/token.service';
import type { IVerificationTokenStore } from './token-store/verification-token-store.interface';
import { VERIFICATION_TOKEN_STORE } from './token-store/verification-token-store.interface';

const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class VerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
    @Inject(MAIL_SERVICE) private readonly mailService: IMailService,
    @Inject(VERIFICATION_TOKEN_STORE) private readonly tokenStore: IVerificationTokenStore,
  ) {}

  async sendVerificationEmail(email: string): Promise<void> {
    const account = await this.prisma.account.findUnique({ where: { email } });
    if (!account) return; // 이메일 존재 여부 노출 방지

    const rawToken = this.tokenService.generateRawRefreshToken();
    const hashed = this.tokenService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);

    await this.tokenStore.save({ token: hashed, type: 'EMAIL_VERIFY', accountId: account.id, expiresAt });

    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    const verifyUrl = `${appUrl}/verify-email?token=${rawToken}`;
    await this.mailService.sendEmailVerification(account.email, verifyUrl);
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const hashed = this.tokenService.hashToken(rawToken);
    const record = await this.tokenStore.findValid(hashed, 'EMAIL_VERIFY');
    if (!record) throw new BadRequestException('유효하지 않거나 만료된 인증 토큰입니다.');

    await this.prisma.account.update({ where: { id: record.accountId }, data: { emailVerifiedAt: new Date() } });
    await this.tokenStore.markUsed(record.id);
  }
}
