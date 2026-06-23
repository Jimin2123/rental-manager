import { IsDateString, IsString } from 'class-validator';

export class CreateTaxInvoiceDto {
  @IsString() invoiceId: string;
  @IsDateString() issueDate: string;
}
