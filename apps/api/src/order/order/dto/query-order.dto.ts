import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderStatus, OrderType } from '@prisma/client';

export class QueryOrderDto {
  @IsOptional() @IsEnum(OrderType) type?: OrderType;
  @IsOptional() @IsEnum(OrderStatus) status?: OrderStatus;
  @IsOptional() @IsString() customerId?: string;
}
