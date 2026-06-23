import { InvoiceAdjustmentType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateInvoiceAdjustmentDto {
  @IsEnum(InvoiceAdjustmentType) type: InvoiceAdjustmentType;
  @IsInt() amount: number;
  @IsString() @IsOptional() reason?: string;
  @IsString() @IsOptional() memo?: string;
}
