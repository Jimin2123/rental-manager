import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ReplaceRentalContractItemDto {
  @IsString()
  newAssetId: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  monthlyRentalPrice?: number;

  @IsString()
  @IsOptional()
  note?: string;
}
