import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRentalOrderItemDto {
  @IsString() productId: string;
  @IsOptional() @IsString() assetId?: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsInt() @Min(0) monthlyRentalPrice: number;
  @IsOptional() @IsInt() @Min(0) depositAmount?: number;
  @IsOptional() @IsString() installationLocation?: string;
  @IsOptional() @IsString() specialTerms?: string;
  @IsOptional() @IsBoolean() isUsedAssetShipment?: boolean;
  @IsOptional() @IsInt() purchaseAmount?: number;
  @IsOptional() @IsDateString() warrantyExpiresAt?: string;
  @IsOptional() @IsString() memo?: string;
}

export class CreateRentalOrderDto {
  @IsOptional() @IsString() managementNo?: string;
  @IsOptional() @IsBoolean() isRenewal?: boolean;
  @IsOptional() @IsDateString() contractDate?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateRentalOrderItemDto) items: CreateRentalOrderItemDto[];
}
