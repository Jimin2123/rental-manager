import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { BusinessPartnerController } from './business-partner/business-partner.controller';
import { BusinessPartnerService } from './business-partner/business-partner.service';

@Module({
  imports: [OrganizationModule],
  providers: [BusinessPartnerService],
  controllers: [BusinessPartnerController],
})
export class CustomerModule {}
