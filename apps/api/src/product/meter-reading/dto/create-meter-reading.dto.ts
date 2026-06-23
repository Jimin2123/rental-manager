import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Matches, Min } from 'class-validator';
import { MeterReadingMethod } from '@prisma/client';

export class CreateMeterReadingDto {
  @IsISO8601()
  readingDate: string;

  @IsInt()
  @Min(0)
  blackCount: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  colorCount?: number;

  @IsUUID()
  @IsOptional()
  rentalContractItemId?: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  @IsOptional()
  billingMonth?: string;

  @IsEnum(MeterReadingMethod)
  @IsOptional()
  readingMethod?: MeterReadingMethod;

  @IsString()
  @IsOptional()
  note?: string;
}
