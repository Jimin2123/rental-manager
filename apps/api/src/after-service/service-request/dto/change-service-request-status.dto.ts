import { IsEnum } from 'class-validator';
import { ServiceRequestStatus } from '@prisma/client';

export class ChangeServiceRequestStatusDto {
  @IsEnum(ServiceRequestStatus)
  status: ServiceRequestStatus;
}
