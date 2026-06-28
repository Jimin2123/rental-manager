import { BillingTiming } from '@prisma/client';
import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateRentalContractItemDto } from './create-rental-contract-item.dto';

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

  // 생성과 동시에 계약 항목을 같은 트랜잭션으로 추가 (주문 항목 자동 복사용)
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateRentalContractItemDto)
  items?: CreateRentalContractItemDto[];
}
