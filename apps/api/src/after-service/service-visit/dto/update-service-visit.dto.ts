import { PartialType } from '@nestjs/mapped-types';
import { CreateServiceVisitDto } from './create-service-visit.dto';

export class UpdateServiceVisitDto extends PartialType(CreateServiceVisitDto) {}
