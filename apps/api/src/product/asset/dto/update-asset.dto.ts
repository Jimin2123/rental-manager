import { IsInt, IsISO8601, IsOptional, IsString } from 'class-validator';

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsISO8601()
  purchaseDate?: string;

  @IsOptional()
  @IsInt()
  purchasePrice?: number;

  @IsOptional()
  @IsString()
  memo?: string;
}
