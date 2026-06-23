import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { VatType } from '@prisma/client';

export class ConvertQuotationItemOverrideDto {
  @IsString() quotationItemId: string;
  @IsOptional() @IsInt() @Min(1) quantity?: number;
  @IsOptional() @IsInt() @Min(0) unitPrice?: number;
  @IsOptional() @IsEnum(VatType) vatType?: VatType;
  @IsOptional() @IsInt() @Min(0) monthlyRentalPrice?: number;
  @IsOptional() @IsInt() @Min(1) contractMonths?: number;
  @IsOptional() @IsInt() @Min(0) depositAmount?: number;
  @IsOptional() @IsString() memo?: string;
}
