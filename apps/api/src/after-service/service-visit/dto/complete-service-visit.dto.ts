import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { AssetStatus, ServiceVisitResult } from '@prisma/client';

export class CompleteServiceVisitDto {
  @IsEnum(ServiceVisitResult)
  result: ServiceVisitResult;

  @IsString()
  @IsOptional()
  workDescription?: string;

  @IsEnum(AssetStatus)
  @IsOptional()
  assetStatusAfter?: AssetStatus;

  @IsInt()
  @Min(0)
  @IsOptional()
  laborCost?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  partsCost?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  travelCost?: number;

  @IsBoolean()
  @IsOptional()
  requiresFollowUp?: boolean;

  @IsString()
  @IsOptional()
  followUpNote?: string;
}
