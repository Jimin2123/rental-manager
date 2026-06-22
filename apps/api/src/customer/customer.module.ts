import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { BusinessPartnerController } from './business-partner/business-partner.controller';
import { BusinessPartnerService } from './business-partner/business-partner.service';
import { CustomerController } from './customer/customer.controller';
import { CustomerService } from './customer/customer.service';

@Module({
  imports: [OrganizationModule],
  providers: [BusinessPartnerService, CustomerService],
  controllers: [BusinessPartnerController, CustomerController],
})
export class CustomerModule {}
