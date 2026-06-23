import { PartialType } from '@nestjs/swagger';
import { CreateRentalContractDto } from './create-rental-contract.dto';
import { OmitType } from '@nestjs/swagger';

export class UpdateRentalContractDto extends PartialType(
  OmitType(CreateRentalContractDto, ['rentalOrderId'] as const),
) {}
