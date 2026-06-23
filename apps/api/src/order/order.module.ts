import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { DocumentSequenceService } from './common/document-sequence.service';
import { QuotationService } from './quotation/quotation.service';
import { QuotationController } from './quotation/quotation.controller';
import { OrderService } from './order/order.service';

@Module({
  imports: [OrganizationModule],
  providers: [DocumentSequenceService, QuotationService, OrderService],
  controllers: [QuotationController],
})
export class OrderModule {}
