import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateOrderDto {
  @IsOptional() @IsString() managerId?: string;
  @IsOptional() @IsDateString() orderDate?: string;
  @IsOptional() @IsString() memo?: string;
}
