import { IsDateString } from 'class-validator';

export class AmendTaxInvoiceDto {
  @IsDateString() issueDate: string;
}
