import { Controller, Delete, Get, HttpCode, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../core/current-user.decorator';
import { JwtAuthGuard } from '../core/jwt-auth.guard';
import type { AuthUser } from '../core/jwt.strategy';
import { SessionService } from './session.service';

@ApiTags('auth')
@Controller('auth/sessions')
@UseGuards(JwtAuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get()
  async listSessions(@CurrentUser() user: AuthUser) {
    return this.sessionService.listActive(user.accountId);
  }

  @Delete(':id')
  @HttpCode(204)
  async revokeSession(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.sessionService.revokeById(id, user.accountId);
  }

  @Delete()
  @HttpCode(204)
  async revokeAllSessions(@CurrentUser() user: AuthUser) {
    await this.sessionService.revokeAll(user.accountId);
  }
}
