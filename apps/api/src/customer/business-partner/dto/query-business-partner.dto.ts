import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { BusinessPartnerRoleType } from '@prisma/client';

export class QueryBusinessPartnerDto {
  @IsEnum(BusinessPartnerRoleType) @IsOptional() role?: BusinessPartnerRoleType;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsString() @IsOptional() q?: string;
  @IsInt() @Min(1) @IsOptional() page?: number;
  @IsInt() @Min(1) @Max(100) @IsOptional() limit?: number;
}
