import { IsOptional, IsString } from 'class-validator';

export class UpdateOrganizationDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() businessType?: string;
  @IsString() @IsOptional() businessItem?: string;
  @IsString() @IsOptional() orgEmail?: string;
  @IsString() @IsOptional() orgPhone?: string;
  @IsString() @IsOptional() memo?: string;
}
