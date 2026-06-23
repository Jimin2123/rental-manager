import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateQuotationDto {
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsString() memo?: string;
}
