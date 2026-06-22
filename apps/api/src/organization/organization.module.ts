import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { OrganizationGuard } from '../common/guards/organization.guard';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';
import { MemberController } from './member/member.controller';
import { MemberService } from './member/member.service';
import { InvitationController } from './invitation/invitation.controller';
import { InvitationService } from './invitation/invitation.service';

@Module({
  imports: [AuthModule, MailModule],
  providers: [OrganizationService, MemberService, InvitationService, OrganizationGuard],
  controllers: [OrganizationController, MemberController, InvitationController],
  exports: [OrganizationGuard],
})
export class OrganizationModule {}
