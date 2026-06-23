import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ReturnRentalContractItemDto {
  @IsDateString()
  @IsOptional()
  returnedAt?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
