import { IsOptional, IsString, Length } from 'class-validator';

export class CreateOrganizationDto {
  @IsString() name: string;
  @IsString() @Length(10, 10) businessRegistrationNo: string;
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
