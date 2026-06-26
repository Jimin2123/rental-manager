import { Body, Controller, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/core/jwt-auth.guard';
import { CurrentUser } from '../auth/core/current-user.decorator';
import type { AuthUser } from '../auth/core/jwt.strategy';
import { OrganizationGuard } from '../common/guards/organization.guard';
import type { OrgContext } from '../common/guards/organization.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OrgCtx } from '../common/decorators/org-context.decorator';
import { OrganizationService } from './organization.service';
import { BrnVerifyService } from './brn-verify.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { VerifyBrnDto } from './dto/verify-brn.dto';

@ApiTags('organizations')
@Controller('organizations')
export class OrganizationController {
  constructor(
    private readonly orgService: OrganizationService,
    private readonly brnVerifyService: BrnVerifyService,
  ) {}

  @Post('brn/verify')
  @HttpCode(200)
  async verifyBrn(@Body() dto: VerifyBrnDto) {
    return this.brnVerifyService.verify(dto.businessRegistrationNo);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateOrganizationDto, @CurrentUser() user: AuthUser) {
    return this.orgService.create(user.userId, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async findMine(@CurrentUser() user: AuthUser) {
    return this.orgService.findMyOrganizations(user.userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, OrganizationGuard)
  async findOne(@Param('id') _id: string, @OrgCtx() ctx: OrgContext) {
    return this.orgService.findById(ctx.organizationId);
  }

  @Patch(':id')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, OrganizationGuard)
  @Roles('OWNER', 'ADMIN')
  async update(@Param('id') _id: string, @Body() dto: UpdateOrganizationDto, @OrgCtx() ctx: OrgContext) {
    return this.orgService.update(ctx.organizationId, dto);
  }
}
