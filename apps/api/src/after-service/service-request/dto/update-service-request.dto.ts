import { PartialType } from '@nestjs/swagger';
import { CreateServiceRequestDto } from './create-service-request.dto';

export class UpdateServiceRequestDto extends PartialType(CreateServiceRequestDto) {}
