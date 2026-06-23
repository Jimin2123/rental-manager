import { IsEnum, IsOptional, IsString } from 'class-validator';
import { QuotationStatus, QuotationType } from '@prisma/client';

export class QueryQuotationDto {
  @IsOptional() @IsEnum(QuotationType) type?: QuotationType;
  @IsOptional() @IsEnum(QuotationStatus) status?: QuotationStatus;
  @IsOptional() @IsString() customerId?: string;
}
