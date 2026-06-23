import { BillingType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateRentalContractItemDto {
  @IsString()
  assetId: string;

  @IsString()
  @IsOptional()
  rentalOrderItemId?: string;

  @IsInt()
  @Min(0)
  monthlyRentalPrice: number;

  @IsEnum(BillingType)
  @IsOptional()
  billingType?: BillingType;

  @IsInt()
  @Min(0)
  @IsOptional()
  freeBlackCount?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  blackUnitPrice?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  freeColorCount?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  colorUnitPrice?: number;

  @IsString()
  @IsOptional()
  installationZonecode?: string;

  @IsString()
  @IsOptional()
  installationAddress?: string;

  @IsString()
  @IsOptional()
  installationAddressDetail?: string;

  @IsString()
  @IsOptional()
  memo?: string;
}
