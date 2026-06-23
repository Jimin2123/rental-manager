import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { FinanceDocumentSequenceService } from './common/document-sequence.service';
import { InvoiceService } from './invoice/invoice.service';
import { InvoiceController } from './invoice/invoice.controller';
import { PaymentService } from './payment/payment.service';
import { PaymentController } from './payment/payment.controller';
import { RefundService } from './refund/refund.service';
import { RefundController } from './refund/refund.controller';
import { TaxInvoiceService } from './tax-invoice/tax-invoice.service';
import { TaxInvoiceController } from './tax-invoice/tax-invoice.controller';
import { InvoiceGenerationCron } from './cron/invoice-generation.cron';

@Module({
  imports: [OrganizationModule],
  providers: [
    FinanceDocumentSequenceService,
    InvoiceService,
    PaymentService,
    RefundService,
    TaxInvoiceService,
    InvoiceGenerationCron,
  ],
  controllers: [InvoiceController, PaymentController, RefundController, TaxInvoiceController],
})
export class FinanceModule {}
