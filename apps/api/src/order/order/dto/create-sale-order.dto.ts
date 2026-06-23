import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VatType } from '@prisma/client';

export class CreateSaleOrderItemDto {
  @IsString() productId: string;
  @IsOptional() @IsString() assetId?: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsInt() @Min(1) quantity: number;
  @IsInt() @Min(0) unitPrice: number;
  @IsEnum(VatType) vatType: VatType;
  @IsOptional() @IsBoolean() isUsedAssetShipment?: boolean;
  @IsOptional() @IsDateString() warrantyStartDate?: string;
  @IsOptional() @IsDateString() warrantyEndDate?: string;
  @IsOptional() @IsInt() marginAmount?: number;
  @IsOptional() @IsString() memo?: string;
}

export class CreateSaleOrderDto {
  @IsOptional() @IsString() deliveryStaffId?: string;
  @IsOptional() @IsDateString() saleDate?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleOrderItemDto)
  items: CreateSaleOrderItemDto[];
}
