import { RefundReason, RefundStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryRefundDto {
  @IsString() @IsOptional() customerId?: string;
  @IsEnum(RefundStatus) @IsOptional() status?: RefundStatus;
  @IsEnum(RefundReason) @IsOptional() reason?: RefundReason;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}
