import { PaymentMethod, RefundReason } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateRefundDto {
  @IsString() customerId: string;
  @IsString() @IsOptional() invoiceId?: string;
  @IsString() @IsOptional() paymentId?: string;
  @IsEnum(RefundReason) reason: RefundReason;
  @IsInt() @Min(1) amount: number;
  @IsEnum(PaymentMethod) @IsOptional() method?: PaymentMethod;
  @IsString() @IsOptional() memo?: string;
}
