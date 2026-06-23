import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { DocumentSequenceService } from './common/document-sequence.service';
import { QuotationService } from './quotation/quotation.service';
import { QuotationController } from './quotation/quotation.controller';
import { OrderService } from './order/order.service';
import { SaleOrderService } from './sale-order/sale-order.service';

@Module({
  imports: [OrganizationModule],
  providers: [DocumentSequenceService, QuotationService, OrderService, SaleOrderService],
  controllers: [QuotationController],
})
export class OrderModule {}
