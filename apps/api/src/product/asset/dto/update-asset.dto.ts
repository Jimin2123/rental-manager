import { IsInt, IsISO8601, IsOptional, IsString, Min } from 'class-validator';

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsISO8601()
  purchaseDate?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @IsString()
  memo?: string;
}
