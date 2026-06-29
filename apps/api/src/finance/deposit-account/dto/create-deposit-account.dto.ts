import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDepositAccountDto {
  @IsString() @IsNotEmpty() bankName: string;
  @IsString() @IsNotEmpty() accountNumber: string;
  @IsString() @IsNotEmpty() accountHolder: string;
  @IsString() @IsOptional() label?: string;
  @IsBoolean() @IsOptional() isDefault?: boolean;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsString() @IsOptional() memo?: string;
}
