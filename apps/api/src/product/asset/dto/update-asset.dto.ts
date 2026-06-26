import { IsInt, IsISO8601, IsOptional, IsString, MinLength, Min } from 'class-validator';

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  serialNumber?: string | null;

  @IsOptional()
  @IsISO8601()
  purchaseDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  purchasePrice?: number | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  supplierId?: string | null;

  @IsOptional()
  @IsString()
  memo?: string | null;
}
