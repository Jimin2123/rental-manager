import { PartialType } from '@nestjs/swagger';
import { CreateServiceVisitDto } from './create-service-visit.dto';

export class UpdateServiceVisitDto extends PartialType(CreateServiceVisitDto) {}
