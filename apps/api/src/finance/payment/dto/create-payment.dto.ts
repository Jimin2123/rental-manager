import { PaymentMethod, PaymentProvider } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsString() customerId: string;
  @IsEnum(PaymentMethod) method: PaymentMethod;
  @IsEnum(PaymentProvider) @IsOptional() provider?: PaymentProvider;
  @IsInt() @Min(1) amount: number;
  @IsDateString() paidAt: string;
  @IsString() @IsOptional() externalRef?: string;
  @IsString() @IsOptional() memo?: string;
  @IsString() @IsOptional() depositAccountId?: string;
}
