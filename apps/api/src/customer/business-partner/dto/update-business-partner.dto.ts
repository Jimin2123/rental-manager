import { IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BusinessPartnerRoleType } from '@prisma/client';

export class UpdateAddressDto {
  @IsString() @IsOptional() zonecode?: string;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() addressDetail?: string;
  @IsString() @IsOptional() jibunAddress?: string;
  @IsString() @IsOptional() roadAddress?: string;
  @IsString() @IsOptional() buildingName?: string;
}

export class UpdateBusinessProfileDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() businessRegistrationNo?: string;
  @IsString() @IsOptional() representativeName?: string;
  @IsString() @IsOptional() businessType?: string;
  @IsString() @IsOptional() businessItem?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @ValidateNested() @Type(() => UpdateAddressDto) @IsOptional() address?: UpdateAddressDto;
}

export class UpdateContactDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() department?: string;
  @IsString() @IsOptional() position?: string;
  @IsString() @IsOptional() role?: string;
  @IsString() @IsOptional() phone?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsBoolean() @IsOptional() isPrimary?: boolean;
  @IsString() @IsOptional() memo?: string;
}

export class UpdateBusinessPartnerDto {
  @IsString() @IsOptional() memo?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsEnum(BusinessPartnerRoleType, { each: true }) @IsArray() @IsOptional() roles?: BusinessPartnerRoleType[];
  @ValidateNested() @Type(() => UpdateBusinessProfileDto) @IsOptional() businessProfile?: UpdateBusinessProfileDto;
}
