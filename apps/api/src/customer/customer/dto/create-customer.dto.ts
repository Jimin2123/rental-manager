import { IsDefined, IsEmail, IsEnum, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerType } from '@prisma/client';
import { CreateAddressDto } from '../../business-partner/dto/create-business-partner.dto';

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

  // 법인 고객은 기존 거래처를 연결한다(새 거래처를 만들지 않음).
  @ValidateIf((o: CreateCustomerDto) => o.type === CustomerType.BUSINESS)
  @IsDefined()
  @IsString()
  businessPartnerId?: string;
}
