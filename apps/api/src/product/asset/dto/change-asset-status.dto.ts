import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AssetStatus } from '@prisma/client';

export class ChangeAssetStatusDto {
  @IsEnum(AssetStatus)
  status: AssetStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
