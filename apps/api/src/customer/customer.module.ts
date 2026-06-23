import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { BusinessPartnerController } from './business-partner/business-partner.controller';
import { BusinessPartnerService } from './business-partner/business-partner.service';
import { CustomerController } from './customer/customer.controller';
import { CustomerService } from './customer/customer.service';
import { AssignmentController } from './assignment/assignment.controller';
import { AssignmentService } from './assignment/assignment.service';

@Module({
  imports: [OrganizationModule],
  providers: [BusinessPartnerService, CustomerService, AssignmentService],
  controllers: [BusinessPartnerController, CustomerController, AssignmentController],
})
export class CustomerModule {}
