import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryMeterReadingDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  @IsOptional()
  billingMonth?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsUUID()
  @IsOptional()
  assetId?: string;

  @IsUUID()
  @IsOptional()
  rentalContractItemId?: string;
}
