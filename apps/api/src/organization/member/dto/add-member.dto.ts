import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { OrganizationMemberRole } from '@prisma/client';

export class AddMemberDto {
  @IsEmail() email: string;
  @IsEnum(OrganizationMemberRole) role: OrganizationMemberRole;
  @IsString() name: string;
  @IsString() @IsOptional() department?: string;
  @IsString() @IsOptional() position?: string;
  @IsString() @IsOptional() memberPhone?: string;
}
