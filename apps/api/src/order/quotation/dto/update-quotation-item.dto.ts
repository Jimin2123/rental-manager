import { PartialType } from '@nestjs/swagger';
import { CreateQuotationItemDto } from './create-quotation-item.dto';

export class UpdateQuotationItemDto extends PartialType(CreateQuotationItemDto) {}
