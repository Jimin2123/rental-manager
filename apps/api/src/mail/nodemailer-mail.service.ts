import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { IMailService } from './mail.interface';

@Injectable()
export class NodemailerMailService implements IMailService {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly logger = new Logger(NodemailerMailService.name);

  constructor(config: ConfigService) {
    this.from = config.get<string>('MAIL_FROM', 'noreply@rental-manager.local');
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('MAIL_HOST', 'localhost'),
      port: config.get<number>('MAIL_PORT', 587),
      auth: {
        user: config.get<string>('MAIL_USER', ''),
        pass: config.get<string>('MAIL_PASS', ''),
      },
    });
  }

  async sendEmailVerification(to: string, verifyUrl: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: '[렌탈매니저] 이메일 인증',
      html: `<p>아래 링크를 클릭하여 이메일을 인증하세요. 링크는 24시간 동안 유효합니다.</p>
             <p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });
    this.logger.log(`Verification email sent to ${to}`);
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: '[렌탈매니저] 비밀번호 재설정',
      html: `<p>아래 링크를 클릭하여 비밀번호를 재설정하세요. 링크는 1시간 동안 유효합니다.</p>
             <p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });
    this.logger.log(`Password reset email sent to ${to}`);
  }

  async sendOrganizationInvite(to: string, inviteUrl: string, organizationName: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: `[렌탈매니저] ${organizationName} 조직 초대`,
      html: `<p><strong>${organizationName}</strong> 조직에 초대되었습니다.</p>
             <p>아래 링크를 클릭하여 초대를 수락하세요. 링크는 7일 동안 유효합니다.</p>
             <p><a href="${inviteUrl}">${inviteUrl}</a></p>`,
    });
    this.logger.log(`Organization invite email sent to ${to}`);
  }
}
