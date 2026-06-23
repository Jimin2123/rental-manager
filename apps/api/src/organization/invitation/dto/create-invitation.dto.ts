import { IsEmail, IsEnum } from 'class-validator';
import { OrganizationMemberRole } from '@prisma/client';

export class CreateInvitationDto {
  @IsEmail() email: string;
  @IsEnum(OrganizationMemberRole) role: OrganizationMemberRole;
}
