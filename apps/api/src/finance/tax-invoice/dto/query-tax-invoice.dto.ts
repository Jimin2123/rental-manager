import { TaxInvoiceStatus, TaxInvoiceType } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryTaxInvoiceDto {
  @IsEnum(TaxInvoiceType) @IsOptional() type?: TaxInvoiceType;
  @IsEnum(TaxInvoiceStatus) @IsOptional() status?: TaxInvoiceStatus;
  @IsString() @IsOptional() customerId?: string;
  @IsDateString() @IsOptional() issueDateFrom?: string;
  @IsDateString() @IsOptional() issueDateTo?: string;
  @IsInt() @Min(1) @IsOptional() page?: number;
  @IsInt() @Min(1) @Max(100) @IsOptional() limit?: number;
}
