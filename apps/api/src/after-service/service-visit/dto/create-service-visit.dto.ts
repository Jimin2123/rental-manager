import { IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateServiceVisitDto {
  @IsUUID()
  @IsOptional()
  staffId?: string;

  @IsISO8601()
  @IsOptional()
  scheduledAt?: string;

  @IsString()
  @IsOptional()
  memo?: string;
}
