import { IsBoolean, IsEmail, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateAddressDto } from '../../business-partner/dto/update-business-partner.dto';

export class UpdateIndividualProfileDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() phone?: string;
  @IsEmail() @IsOptional() email?: string;
  @ValidateNested() @Type(() => UpdateAddressDto) @IsOptional() address?: UpdateAddressDto;
}

export class UpdateCustomerDto {
  @IsString() @IsOptional() memo?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @ValidateNested()
  @Type(() => UpdateIndividualProfileDto)
  @IsOptional()
  individualProfile?: UpdateIndividualProfileDto;
}
