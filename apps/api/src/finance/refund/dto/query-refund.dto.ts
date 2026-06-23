import { RefundReason, RefundStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryRefundDto {
  @IsString() @IsOptional() customerId?: string;
  @IsEnum(RefundStatus) @IsOptional() status?: RefundStatus;
  @IsEnum(RefundReason) @IsOptional() reason?: RefundReason;
  @IsInt() @Min(1) @IsOptional() page?: number;
  @IsInt() @Min(1) @Max(100) @IsOptional() limit?: number;
}
