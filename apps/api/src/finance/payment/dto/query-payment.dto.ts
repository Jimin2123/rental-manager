import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryPaymentDto {
  @IsString() @IsOptional() customerId?: string;
  @IsEnum(PaymentMethod) @IsOptional() method?: PaymentMethod;
  @IsEnum(PaymentStatus) @IsOptional() status?: PaymentStatus;
  @IsInt() @Min(1) @IsOptional() page?: number;
  @IsInt() @Min(1) @Max(100) @IsOptional() limit?: number;
}
