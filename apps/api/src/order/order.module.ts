import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { DocumentSequenceService } from './common/document-sequence.service';
import { QuotationService } from './quotation/quotation.service';
import { QuotationController } from './quotation/quotation.controller';

@Module({
  imports: [OrganizationModule],
  providers: [DocumentSequenceService, QuotationService],
  controllers: [QuotationController],
})
export class OrderModule {}
