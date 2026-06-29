import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { DepositAccountService } from './deposit-account.service';
import { CreateDepositAccountDto } from './dto/create-deposit-account.dto';
import { UpdateDepositAccountDto } from './dto/update-deposit-account.dto';
import { QueryDepositAccountDto } from './dto/query-deposit-account.dto';

@ApiTags('deposit-accounts')
@Controller('deposit-accounts')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class DepositAccountController {
  constructor(private readonly service: DepositAccountService) {}

  @Get()
  async list(@Query() query: QueryDepositAccountDto, @OrgCtx() ctx: OrgContext) {
    return this.service.list(ctx.organizationId, query.includeInactive);
  }

  @Post()
  @Roles('OWNER', 'ADMIN')
  async create(@Body() dto: CreateDepositAccountDto, @OrgCtx() ctx: OrgContext) {
    return this.service.create(ctx.organizationId, dto);
  }

  @Patch(':id')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateDepositAccountDto, @OrgCtx() ctx: OrgContext) {
    return this.service.update(ctx.organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  async remove(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    await this.service.remove(ctx.organizationId, id);
  }
}
