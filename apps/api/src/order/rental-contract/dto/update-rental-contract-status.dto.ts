import { RentalContractStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateRentalContractStatusDto {
  @IsEnum(RentalContractStatus)
  status: RentalContractStatus;
}
