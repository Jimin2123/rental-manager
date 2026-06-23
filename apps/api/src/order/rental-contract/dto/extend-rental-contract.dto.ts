import { IsDateString, IsInt, Min } from 'class-validator';

export class ExtendRentalContractDto {
  @IsDateString()
  endDate: string;

  @IsInt()
  @Min(1)
  contractMonths: number;
}
