import { IsEnum, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { MaintenanceIntervalUnit } from '@prisma/client';

export class CreateMaintenanceScheduleDto {
  @IsUUID()
  rentalContractId: string;

  @IsEnum(MaintenanceIntervalUnit)
  intervalUnit: MaintenanceIntervalUnit;

  @IsInt()
  @Min(1)
  intervalValue: number;

  @IsISO8601()
  nextScheduledAt: string;

  @IsUUID()
  @IsOptional()
  assignedStaffId?: string;

  @IsString()
  @IsOptional()
  memo?: string;
}
