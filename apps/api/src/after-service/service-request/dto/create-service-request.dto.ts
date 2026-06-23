import { IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';
import { ServiceRequestType } from '@prisma/client';

export class CreateServiceRequestDto {
  @IsEnum(ServiceRequestType)
  type: ServiceRequestType;

  @IsUUID()
  customerId: string;

  @IsUUID()
  assetId: string;

  @IsBoolean()
  @IsOptional()
  isWarranty?: boolean;

  @IsString()
  @IsOptional()
  description?: string;

  @IsISO8601()
  @IsOptional()
  requestedVisitDate?: string;

  @IsString()
  @IsOptional()
  visitLocationZonecode?: string;

  @IsString()
  @IsOptional()
  visitLocationAddress?: string;

  @IsString()
  @IsOptional()
  visitLocationAddressDetail?: string;

  @IsUUID()
  @IsOptional()
  maintenanceScheduleId?: string;

  @IsString()
  @IsOptional()
  memo?: string;
}
