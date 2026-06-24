import { IsString, Length } from 'class-validator';

export class VerifyBrnDto {
  @IsString()
  @Length(10, 10)
  businessRegistrationNo: string;
}
