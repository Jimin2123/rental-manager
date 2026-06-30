import { IsBoolean, IsInt, IsISO8601, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class QueryMaintenanceScheduleDto {
  @IsUUID()
  @IsOptional()
  rentalContractId?: string;

  @IsUUID()
  @IsOptional()
  assignedStaffId?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ obj, key }) => {
    const raw = (obj as Record<string, unknown>)[key];
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (typeof raw === 'boolean') return raw;
    return undefined;
  })
  isActive?: boolean;

  @IsISO8601()
  @IsOptional()
  dueBefore?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
