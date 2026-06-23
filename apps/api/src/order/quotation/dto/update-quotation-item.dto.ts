import { PartialType } from '@nestjs/mapped-types';
import { CreateQuotationItemDto } from './create-quotation-item.dto';

export class UpdateQuotationItemDto extends PartialType(CreateQuotationItemDto) {}
