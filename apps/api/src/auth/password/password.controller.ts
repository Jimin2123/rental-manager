import { Body, Controller, HttpCode, Post, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../core/current-user.decorator';
import { JwtAuthGuard } from '../core/jwt-auth.guard';
import type { AuthUser } from '../core/jwt.strategy';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto, SendResetDto } from './dto/reset-password.dto';
import { PasswordService } from './password.service';

@ApiTags('auth')
@Controller('auth/password')
export class PasswordController {
  constructor(private readonly passwordService: PasswordService) {}

  @Post('reset/send')
  @HttpCode(200)
  async sendReset(@Body() dto: SendResetDto) {
    await this.passwordService.sendResetEmail(dto.email);
    return { message: '비밀번호 재설정 이메일을 발송했습니다.' };
  }

  @Post('reset')
  @HttpCode(200)
  async reset(@Body() dto: ResetPasswordDto) {
    await this.passwordService.resetPassword(dto.token, dto.newPassword);
    return { message: '비밀번호가 변경되었습니다.' };
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  async change(@Body() dto: ChangePasswordDto, @CurrentUser() user: AuthUser) {
    await this.passwordService.changePassword(user.accountId, dto.currentPassword, dto.newPassword);
    return { message: '비밀번호가 변경되었습니다.' };
  }
}
