import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { BusinessPartnerService } from './business-partner.service';
import { CreateBusinessPartnerDto, CreateContactDto } from './dto/create-business-partner.dto';
import { UpdateBusinessPartnerDto, UpdateContactDto } from './dto/update-business-partner.dto';
import { QueryBusinessPartnerDto } from './dto/query-business-partner.dto';

@ApiTags('business-partners')
@Controller('business-partners')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class BusinessPartnerController {
  constructor(private readonly service: BusinessPartnerService) {}

  @Get()
  async findAll(@Query() query: QueryBusinessPartnerDto, @OrgCtx() ctx: OrgContext) {
    return this.service.findAll(ctx.organizationId, query);
  }

  @Post()
  async create(@Body() dto: CreateBusinessPartnerDto, @OrgCtx() ctx: OrgContext) {
    return this.service.create(ctx.organizationId, dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.findOne(ctx.organizationId, id);
  }

  @Patch(':id')
  @HttpCode(200)
  async update(@Param('id') id: string, @Body() dto: UpdateBusinessPartnerDto, @OrgCtx() ctx: OrgContext) {
    return this.service.update(ctx.organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  async softDelete(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.softDelete(ctx.organizationId, id);
  }

  @Post(':id/contacts')
  async addContact(@Param('id') id: string, @Body() dto: CreateContactDto, @OrgCtx() ctx: OrgContext) {
    return this.service.addContact(ctx.organizationId, id, dto);
  }

  @Patch(':id/contacts/:contactId')
  @HttpCode(200)
  async updateContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateContactDto,
    @OrgCtx() ctx: OrgContext,
  ) {
    return this.service.updateContact(ctx.organizationId, id, contactId, dto);
  }

  @Delete(':id/contacts/:contactId')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  async removeContact(@Param('id') id: string, @Param('contactId') contactId: string, @OrgCtx() ctx: OrgContext) {
    return this.service.removeContact(ctx.organizationId, id, contactId);
  }
}
