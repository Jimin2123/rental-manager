import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { CurrentUser } from '../../auth/core/current-user.decorator';
import type { AuthUser } from '../../auth/core/jwt.strategy';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { InvitationService } from './invitation.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';

@ApiTags('invitations')
@Controller()
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post('organizations/:id/invitations')
  @UseGuards(JwtAuthGuard, OrganizationGuard)
  @Roles('OWNER', 'ADMIN')
  async send(@Body() dto: CreateInvitationDto, @OrgCtx() ctx: OrgContext) {
    return this.invitationService.send(ctx.organizationId, ctx.memberId, dto);
  }

  @Get('invitations/:token')
  async getByToken(@Param('token') token: string) {
    return this.invitationService.getByToken(token);
  }

  @Post('invitations/:token/accept')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async accept(@Param('token') token: string, @CurrentUser() user: AuthUser) {
    return this.invitationService.accept(token, user.userId);
  }
}
