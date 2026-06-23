import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AssignmentService } from './assignment.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@ApiTags('customers')
@Controller('customers/:customerId/assignments')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class AssignmentController {
  constructor(private readonly service: AssignmentService) {}

  @Get()
  async list(@Param('customerId') customerId: string, @OrgCtx() ctx: OrgContext) {
    return this.service.list(ctx.organizationId, customerId);
  }

  @Post()
  async create(@Param('customerId') customerId: string, @Body() dto: CreateAssignmentDto, @OrgCtx() ctx: OrgContext) {
    return this.service.create(ctx.organizationId, customerId, dto);
  }

  @Patch(':assignmentId')
  @HttpCode(200)
  async update(
    @Param('customerId') customerId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: UpdateAssignmentDto,
    @OrgCtx() ctx: OrgContext,
  ) {
    return this.service.update(ctx.organizationId, customerId, assignmentId, dto);
  }

  @Delete(':assignmentId')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  async remove(
    @Param('customerId') customerId: string,
    @Param('assignmentId') assignmentId: string,
    @OrgCtx() ctx: OrgContext,
  ) {
    return this.service.remove(ctx.organizationId, customerId, assignmentId);
  }
}
