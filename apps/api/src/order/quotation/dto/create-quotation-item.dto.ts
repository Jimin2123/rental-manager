import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { VatType } from '@prisma/client';

export class CreateQuotationItemDto {
  @IsString() productId: string;
  @IsOptional() @IsString() assetId?: string;
  @IsOptional() @IsString() description?: string;
  @IsInt() @Min(1) quantity: number;
  @IsInt() @Min(0) unitPrice: number;
  @IsEnum(VatType) vatType: VatType;
  @IsOptional() @IsInt() @Min(0) monthlyRentalPrice?: number;
  @IsOptional() @IsInt() @Min(1) contractMonths?: number;
  @IsOptional() @IsInt() @Min(0) depositAmount?: number;
  @IsOptional() @IsString() memo?: string;
}
