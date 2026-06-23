import { InvoiceType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateInvoiceDto {
  @IsEnum(InvoiceType)
  type: InvoiceType;

  @IsString()
  customerId: string;

  @IsString() @IsOptional() saleOrderId?: string;
  @IsString() @IsOptional() rentalContractId?: string;
  @IsString() @IsOptional() serviceRequestId?: string;
  @IsString() @IsOptional() billingMonth?: string;
  @IsDateString() @IsOptional() periodStart?: string;
  @IsDateString() @IsOptional() periodEnd?: string;
  @IsDateString() @IsOptional() dueDate?: string;
  @IsString() @IsOptional() memo?: string;
}
