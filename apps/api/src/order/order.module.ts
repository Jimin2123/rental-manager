import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { DocumentSequenceService } from './common/document-sequence.service';
import { QuotationService } from './quotation/quotation.service';

@Module({
  imports: [OrganizationModule],
  providers: [DocumentSequenceService, QuotationService],
  controllers: [],
})
export class OrderModule {}
