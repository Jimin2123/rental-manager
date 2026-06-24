import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Min } from 'class-validator';

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
  supplierId?: string;

  @IsOptional()
  @IsString()
  memo?: string;
}
