import { PartialType } from '@nestjs/mapped-types';
import { CreateRentalOrderItemDto } from './create-rental-order-item.dto';

export class UpdateRentalOrderItemDto extends PartialType(CreateRentalOrderItemDto) {}
