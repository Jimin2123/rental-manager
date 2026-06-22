import { IsInt, IsISO8601, IsOptional, IsString, IsIn } from 'class-validator';

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
  purchasePrice?: number;

  @IsOptional()
  @IsString()
  memo?: string;
}
