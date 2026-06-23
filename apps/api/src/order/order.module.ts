import { Module } from '@nestjs/common';
import { ProductModule } from '../product/product.module';
import { OrganizationModule } from '../organization/organization.module';
import { DocumentSequenceService } from './common/document-sequence.service';
import { QuotationService } from './quotation/quotation.service';
import { QuotationController } from './quotation/quotation.controller';
import { OrderService } from './order/order.service';
import { OrderController } from './order/order.controller';
import { SaleOrderService } from './sale-order/sale-order.service';
import { SaleOrderController } from './sale-order/sale-order.controller';
import { RentalOrderService } from './rental-order/rental-order.service';
import { RentalOrderController } from './rental-order/rental-order.controller';
import { RentalContractService } from './rental-contract/rental-contract.service';
import { RentalContractController } from './rental-contract/rental-contract.controller';
import { RentalContractExpiryCron } from './cron/rental-contract-expiry.cron';

@Module({
  imports: [OrganizationModule, ProductModule],
  providers: [
    DocumentSequenceService,
    QuotationService,
    OrderService,
    SaleOrderService,
    RentalOrderService,
    RentalContractService,
    RentalContractExpiryCron,
  ],
  controllers: [
    QuotationController,
    OrderController,
    SaleOrderController,
    RentalOrderController,
    RentalContractController,
  ],
})
export class OrderModule {}
