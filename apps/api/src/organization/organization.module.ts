import { Module } from '@nestjs/common';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { MemberController } from './member/member.controller';
import { MemberService } from './member/member.service';
import { OrganizationGuard } from '../common/guards/organization.guard';

@Module({
  providers: [OrganizationService, MemberService, OrganizationGuard],
  controllers: [OrganizationController, MemberController],
  exports: [OrganizationGuard],
})
export class OrganizationModule {}
