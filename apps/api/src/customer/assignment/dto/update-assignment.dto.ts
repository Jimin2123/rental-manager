import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateAssignmentDto {
  @IsString() @IsOptional() role?: string;
  @IsBoolean() @IsOptional() isPrimary?: boolean;
  @IsDateString() @IsOptional() startedAt?: string;
  @IsDateString() @IsOptional() endedAt?: string;
  @IsString() @IsOptional() memo?: string;
  @IsString() @IsOptional() customerContactId?: string;
}
