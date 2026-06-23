import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AssetStatus } from '@prisma/client';

export class QueryAssetDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
