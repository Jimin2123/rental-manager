import { PartialType } from '@nestjs/swagger';
import { CreateRentalOrderItemDto } from './create-rental-order-item.dto';

export class UpdateRentalOrderItemDto extends PartialType(CreateRentalOrderItemDto) {}
