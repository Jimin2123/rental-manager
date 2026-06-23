import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrganizationMemberRole } from '@prisma/client';

export class UpdateMemberDto {
  @IsEnum(OrganizationMemberRole) @IsOptional() role?: OrganizationMemberRole;
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() department?: string;
  @IsString() @IsOptional() position?: string;
  @IsString() @IsOptional() memberPhone?: string;
  @IsString() @IsOptional() memberEmail?: string;
}
