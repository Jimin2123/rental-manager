import { IsArray, IsDateString, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSaleOrderItemDto } from './create-sale-order.dto';
import { CreateRentalOrderItemDto } from './create-rental-order.dto';

export class UpdateOrderDto {
  @IsOptional() @IsString() managerId?: string;
  @IsOptional() @IsDateString() orderDate?: string;
  @IsOptional() @IsString() memo?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleOrderItemDto)
  saleItems?: CreateSaleOrderItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRentalOrderItemDto)
  rentalItems?: CreateRentalOrderItemDto[];
}
