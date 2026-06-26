import { IsIn, IsInt, IsISO8601, IsOptional, IsString, MinLength, Min } from 'class-validator';

export class CreateAssetDto {
  @IsString()
  productId: string;

  @IsIn(['INCOMING', 'AVAILABLE'])
  initialStatus: 'INCOMING' | 'AVAILABLE';

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
  @MinLength(1)
  supplierId?: string;

  @IsOptional()
  @IsString()
  memo?: string;
}
