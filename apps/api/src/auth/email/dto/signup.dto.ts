import { IsEmail, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class SignupDto {
  // 계정 정보
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  // 사용자 정보
  @IsString()
  memberName: string;

  // 사업자 정보
  @IsString()
  name: string;

  @IsString()
  @Length(10, 10)
  businessRegistrationNo: string;

  @IsString()
  representativeName: string;

  @IsString()
  @IsOptional()
  businessType?: string;

  @IsString()
  @IsOptional()
  businessItem?: string;

  @IsString()
  @IsOptional()
  orgEmail?: string;

  @IsString()
  @IsOptional()
  orgPhone?: string;

  // 주소
  @IsString()
  zonecode: string;

  @IsString()
  address: string;

  @IsString()
  @IsOptional()
  addressDetail?: string;

  @IsString()
  @IsOptional()
  jibunAddress?: string;

  @IsString()
  @IsOptional()
  roadAddress?: string;

  @IsString()
  @IsOptional()
  buildingName?: string;
}
