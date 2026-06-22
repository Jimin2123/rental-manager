import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';
import { VerificationService } from './verification.service';

class SendVerifyDto {
  @IsEmail()
  email: string;
}

class VerifyEmailDto {
  @IsString()
  token: string;
}

@ApiTags('auth')
@Controller('auth/email')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Post('verify/send')
  @HttpCode(200)
  async sendVerification(@Body() dto: SendVerifyDto) {
    await this.verificationService.sendVerificationEmail(dto.email);
    return { message: '인증 이메일을 발송했습니다.' };
  }

  @Post('verify')
  @HttpCode(200)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    await this.verificationService.verifyEmail(dto.token);
    return { message: '이메일 인증이 완료되었습니다.' };
  }
}
