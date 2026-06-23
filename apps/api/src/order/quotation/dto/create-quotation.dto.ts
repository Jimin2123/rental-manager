import { ArrayMinSize, IsArray, IsDateString, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { QuotationType } from '@prisma/client';
import { CreateQuotationItemDto } from './create-quotation-item.dto';

export class CreateQuotationDto {
  @IsEnum(QuotationType) type: QuotationType;
  @IsString() customerId: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsString() memo?: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateQuotationItemDto) items: CreateQuotationItemDto[];
}
