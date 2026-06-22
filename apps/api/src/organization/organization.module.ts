import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { OrganizationGuard } from '../common/guards/organization.guard';

@Module({
  providers: [OrganizationService, OrganizationGuard],
  controllers: [OrganizationController],
  exports: [OrganizationGuard],
})
export class OrganizationModule {}
