import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { AssetEventService } from './asset-event.service';

@ApiTags('assets')
@Controller('assets')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class AssetEventController {
  constructor(private readonly service: AssetEventService) {}

  @Get(':assetId/events')
  async findByAsset(@Param('assetId') assetId: string, @OrgCtx() ctx: OrgContext) {
    return this.service.findByAsset(ctx.organizationId, assetId);
  }
}
