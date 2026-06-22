import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import type { IMailService } from '../../mail/mail.interface';
import { MAIL_SERVICE } from '../../mail/mail.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../session/token.service';
import type { IVerificationTokenStore } from '../verification/token-store/verification-token-store.interface';
import { VERIFICATION_TOKEN_STORE } from '../verification/token-store/verification-token-store.interface';

const BCRYPT_ROUNDS = 12;
const HISTORY_CHECK = 5;
const RESET_TTL_MS = 60 * 60 * 1000; // 1h

@Injectable()
export class PasswordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
    @Inject(MAIL_SERVICE) private readonly mailService: IMailService,
    @Inject(VERIFICATION_TOKEN_STORE) private readonly tokenStore: IVerificationTokenStore,
  ) {}

  async sendResetEmail(email: string): Promise<void> {
    const account = await this.prisma.account.findUnique({ where: { email } });
    if (!account) return; // 이메일 존재 여부 노출 방지

    const rawToken = this.tokenService.generateRawRefreshToken();
    const hashed = this.tokenService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TTL_MS);

    await this.tokenStore.save({ token: hashed, type: 'PASSWORD_RESET', accountId: account.id, expiresAt });

    const appUrl = this.config.get<string>('APP_URL', 'http://localhost:3000');
    const resetUrl = `${appUrl}/auth/password/reset?token=${rawToken}`;
    await this.mailService.sendPasswordReset(account.email, resetUrl);
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const hashed = this.tokenService.hashToken(rawToken);
    const record = await this.tokenStore.findValid(hashed, 'PASSWORD_RESET');
    if (!record) throw new BadRequestException('유효하지 않거나 만료된 토큰입니다.');

    await this.assertNotInHistory(record.accountId, newPassword);

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction(async (tx) => {
      await tx.account.update({ where: { id: record.accountId }, data: { passwordHash } });
      await tx.passwordHistory.create({ data: { accountId: record.accountId, passwordHash } });
      await tx.refreshToken.updateMany({
        where: { accountId: record.accountId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    await this.tokenStore.markUsed(record.id);
  }

  async changePassword(accountId: string, currentPassword: string, newPassword: string): Promise<void> {
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });
    if (!account || !account.passwordHash) throw new NotFoundException('계정을 찾을 수 없습니다.');

    const valid = await bcrypt.compare(currentPassword, account.passwordHash);
    if (!valid) throw new UnauthorizedException('현재 비밀번호가 올바르지 않습니다.');

    await this.assertNotInHistory(accountId, newPassword);

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction(async (tx) => {
      await tx.account.update({ where: { id: accountId }, data: { passwordHash } });
      await tx.passwordHistory.create({ data: { accountId, passwordHash } });
      await tx.refreshToken.updateMany({
        where: { accountId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  private async assertNotInHistory(accountId: string, newPassword: string): Promise<void> {
    const history = await this.prisma.passwordHistory.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_CHECK,
    });
    for (const entry of history) {
      if (await bcrypt.compare(newPassword, entry.passwordHash)) {
        throw new BadRequestException(`최근 ${HISTORY_CHECK}개의 비밀번호는 재사용할 수 없습니다.`);
      }
    }
  }
}
