import { OmitType, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateRentalContractDto } from './create-rental-contract.dto';

export class UpdateRentalContractDto extends PartialType(
  OmitType(CreateRentalContractDto, ['rentalOrderId'] as const),
) {
  @IsBoolean()
  @IsOptional()
  autoExpire?: boolean;
}
