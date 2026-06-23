import { InvoiceSettlementStatus, InvoiceStatus, InvoiceType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryInvoiceDto {
  @IsEnum(InvoiceType) @IsOptional() type?: InvoiceType;
  @IsEnum(InvoiceStatus) @IsOptional() status?: InvoiceStatus;
  @IsEnum(InvoiceSettlementStatus) @IsOptional() settlementStatus?: InvoiceSettlementStatus;
  @IsString() @IsOptional() billingMonth?: string;
  @IsString() @IsOptional() customerId?: string;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}
