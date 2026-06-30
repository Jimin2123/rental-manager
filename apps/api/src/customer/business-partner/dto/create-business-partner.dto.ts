import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BusinessPartnerRoleType } from '@prisma/client';

export class CreateAddressDto {
  @IsString() zonecode: string;
  @IsString() address: string;
  @IsString() @IsOptional() addressDetail?: string;
  @IsString() @IsOptional() jibunAddress?: string;
  @IsString() @IsOptional() roadAddress?: string;
  @IsString() @IsOptional() buildingName?: string;
}

export class CreateBusinessProfileDto {
  @IsString() name: string;
  @IsString()
  @Matches(/^\d{3}-\d{2}-\d{5}$/, { message: '올바른 사업자등록번호 형식이 아닙니다. (예: 123-45-67890)' })
  businessRegistrationNo: string;
  @IsString() representativeName: string;
  @IsString() @IsOptional() businessType?: string;
  @IsString() @IsOptional() businessItem?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @ValidateNested() @Type(() => CreateAddressDto) address: CreateAddressDto;
}

export class CreateContactDto {
  @IsString() name: string;
  @IsString() @IsOptional() department?: string;
  @IsString() @IsOptional() position?: string;
  @IsString() @IsOptional() role?: string;
  @IsString() @IsOptional() phone?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsBoolean() @IsOptional() isPrimary?: boolean;
  @IsString() @IsOptional() memo?: string;
}

export class CreateBusinessPartnerDto {
  @IsEnum(BusinessPartnerRoleType, { each: true })
  @IsArray()
  @ArrayMinSize(1)
  roles: BusinessPartnerRoleType[];

  @IsString() @IsOptional() memo?: string;

  @ValidateNested()
  @Type(() => CreateBusinessProfileDto)
  businessProfile: CreateBusinessProfileDto;

  @ValidateNested({ each: true })
  @Type(() => CreateContactDto)
  @IsArray()
  @IsOptional()
  contacts?: CreateContactDto[];
}
