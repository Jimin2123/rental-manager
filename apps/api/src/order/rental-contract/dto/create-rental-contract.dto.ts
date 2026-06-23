import { BillingTiming } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateRentalContractDto {
  @IsString()
  rentalOrderId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsInt()
  @Min(1)
  contractMonths: number;

  @IsInt()
  @Min(1)
  @Max(31)
  @IsOptional()
  billingDay?: number;

  @IsInt()
  @Min(1)
  @Max(31)
  @IsOptional()
  paymentDueDay?: number;

  @IsEnum(BillingTiming)
  @IsOptional()
  billingTiming?: BillingTiming;
}
