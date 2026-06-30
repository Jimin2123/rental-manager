import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { CommonModule } from '../common/common.module';
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
import { DepositAccountService } from './deposit-account/deposit-account.service';
import { DepositAccountController } from './deposit-account/deposit-account.controller';

@Module({
  imports: [OrganizationModule, CommonModule],
  providers: [
    FinanceDocumentSequenceService,
    InvoiceService,
    PaymentService,
    RefundService,
    TaxInvoiceService,
    InvoiceGenerationCron,
    DepositAccountService,
  ],
  controllers: [InvoiceController, PaymentController, RefundController, TaxInvoiceController, DepositAccountController],
  exports: [InvoiceService, FinanceDocumentSequenceService],
})
export class FinanceModule {}
