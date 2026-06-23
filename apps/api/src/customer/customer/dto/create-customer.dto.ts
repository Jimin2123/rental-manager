import { IsDefined, IsEmail, IsEnum, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerType } from '@prisma/client';
import { CreateAddressDto, CreateBusinessPartnerDto } from '../../business-partner/dto/create-business-partner.dto';

export class CreateIndividualProfileDto {
  @IsString() name: string;
  @IsString() @IsOptional() phone?: string;
  @IsEmail() @IsOptional() email?: string;
  @ValidateNested() @Type(() => CreateAddressDto) @IsOptional() address?: CreateAddressDto;
}

export class CreateCustomerDto {
  @IsEnum(CustomerType) type: CustomerType;
  @IsString() @IsOptional() memo?: string;

  @ValidateIf((o: CreateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateIndividualProfileDto)
  individualProfile?: CreateIndividualProfileDto;

  @ValidateIf((o: CreateCustomerDto) => o.type === CustomerType.BUSINESS)
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateBusinessPartnerDto)
  businessPartner?: CreateBusinessPartnerDto;
}
