import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { DocumentSequenceService } from './common/document-sequence.service';

@Module({
  imports: [OrganizationModule],
  providers: [DocumentSequenceService],
  controllers: [],
})
export class OrderModule {}
