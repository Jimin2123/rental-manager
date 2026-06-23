import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { ProductModule } from '../product/product.module';
import { FinanceModule } from '../finance/finance.module';
import { ServiceRequestService } from './service-request/service-request.service';
import { ServiceRequestController } from './service-request/service-request.controller';
import { ServiceVisitService } from './service-visit/service-visit.service';
import { ServiceVisitNestedController, ServiceVisitController } from './service-visit/service-visit.controller';
import { MaintenanceScheduleService } from './maintenance-schedule/maintenance-schedule.service';
import { MaintenanceScheduleController } from './maintenance-schedule/maintenance-schedule.controller';

@Module({
  imports: [OrganizationModule, ProductModule, FinanceModule],
  providers: [ServiceRequestService, ServiceVisitService, MaintenanceScheduleService],
  controllers: [
    ServiceRequestController,
    ServiceVisitNestedController,
    ServiceVisitController,
    MaintenanceScheduleController,
  ],
})
export class AfterServiceModule {}
