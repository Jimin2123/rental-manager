import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateAssignmentDto {
  @IsString() organizationMemberId: string;
  @IsString() @IsOptional() customerContactId?: string;
  @IsString() @IsOptional() individualProfileId?: string;
  @IsString() @IsOptional() role?: string;
  @IsBoolean() @IsOptional() isPrimary?: boolean;
  @IsDateString() @IsOptional() startedAt?: string;
  @IsDateString() @IsOptional() endedAt?: string;
  @IsString() @IsOptional() memo?: string;
}
