import { IsArray, IsDateString, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ConvertQuotationItemOverrideDto } from './convert-quotation-item-override.dto';

export class ConvertQuotationDto {
  @IsOptional() @IsString() managerId?: string;
  @IsOptional() @IsDateString() orderDate?: string;
  @IsOptional() @IsString() memo?: string;
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConvertQuotationItemOverrideDto)
  items?: ConvertQuotationItemOverrideDto[];
}
