import { IsDateString, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderType } from '@prisma/client';
import { CreateSaleOrderDto } from './create-sale-order.dto';
import { CreateRentalOrderDto } from './create-rental-order.dto';

export class CreateOrderDto {
  @IsEnum(OrderType) type: OrderType;
  @IsString() customerId: string;
  @IsOptional() @IsString() managerId?: string;
  @IsOptional() @IsDateString() orderDate?: string;
  @IsOptional() @IsString() memo?: string;
  @IsOptional() @ValidateNested() @Type(() => CreateSaleOrderDto) saleOrder?: CreateSaleOrderDto;
  @IsOptional() @ValidateNested() @Type(() => CreateRentalOrderDto) rentalOrder?: CreateRentalOrderDto;
}
