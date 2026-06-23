import { PartialType } from '@nestjs/mapped-types';
import { CreateSaleOrderItemDto } from './create-sale-order-item.dto';

export class UpdateSaleOrderItemDto extends PartialType(CreateSaleOrderItemDto) {}
