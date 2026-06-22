import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { MemberService } from './member.service';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@ApiTags('organizations')
@Controller('organizations')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Get(':id/members')
  async list(@Param('id') _id: string, @OrgCtx() ctx: OrgContext) {
    return this.memberService.list(ctx.organizationId);
  }

  @Post(':id/members')
  @Roles('OWNER', 'ADMIN')
  async addDirect(@Param('id') _id: string, @Body() dto: AddMemberDto, @OrgCtx() ctx: OrgContext) {
    return this.memberService.addDirect(ctx.organizationId, dto);
  }

  @Patch(':id/members/:memberId')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  async update(
    @Param('id') _id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
    @OrgCtx() ctx: OrgContext,
  ) {
    return this.memberService.update(ctx.organizationId, memberId, dto);
  }

  @Delete(':id/members/:memberId')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  async deactivate(@Param('id') _id: string, @Param('memberId') memberId: string, @OrgCtx() ctx: OrgContext) {
    return this.memberService.deactivate(ctx.organizationId, memberId);
  }
}
