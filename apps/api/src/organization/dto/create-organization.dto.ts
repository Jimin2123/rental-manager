import { IsOptional, IsString, Matches } from 'class-validator';

export class CreateOrganizationDto {
  @IsString() name: string;
  @IsString()
  @Matches(/^\d{3}-\d{2}-\d{5}$/, { message: '올바른 사업자등록번호 형식이 아닙니다. (예: 123-45-67890)' })
  businessRegistrationNo: string;
  @IsString() representativeName: string;
  @IsString() @IsOptional() businessType?: string;
  @IsString() @IsOptional() businessItem?: string;
  @IsString() @IsOptional() orgEmail?: string;
  @IsString() @IsOptional() orgPhone?: string;

  @IsString() zonecode: string;
  @IsString() address: string;
  @IsString() @IsOptional() addressDetail?: string;
  @IsString() @IsOptional() jibunAddress?: string;
  @IsString() @IsOptional() roadAddress?: string;
  @IsString() @IsOptional() buildingName?: string;

  @IsString() memberName: string;
}
