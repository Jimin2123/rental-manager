import { InvoiceItemType, VatType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateInvoiceItemDto {
  @IsEnum(InvoiceItemType) type: InvoiceItemType;
  @IsString() @IsOptional() description?: string;
  @IsInt() @Min(1) quantity: number;
  @IsInt() unitPrice: number;
  @IsEnum(VatType) @IsOptional() vatType?: VatType;
  @IsString() @IsOptional() saleOrderItemId?: string;
  @IsString() @IsOptional() rentalOrderItemId?: string;
  @IsString() @IsOptional() rentalContractItemId?: string;
  @IsString() @IsOptional() memo?: string;
}
