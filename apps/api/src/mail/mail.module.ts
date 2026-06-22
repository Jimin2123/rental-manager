import { Module } from '@nestjs/common';
import { MAIL_SERVICE } from './mail.interface';
import { NodemailerMailService } from './nodemailer-mail.service';

@Module({
  providers: [{ provide: MAIL_SERVICE, useClass: NodemailerMailService }],
  exports: [MAIL_SERVICE],
})
export class MailModule {}
