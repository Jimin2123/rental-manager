import { PartialType } from '@nestjs/swagger';
import { OmitType } from '@nestjs/swagger';
import { CreateRentalContractItemDto } from './create-rental-contract-item.dto';

export class UpdateRentalContractItemDto extends PartialType(
  OmitType(CreateRentalContractItemDto, ['assetId'] as const),
) {}
