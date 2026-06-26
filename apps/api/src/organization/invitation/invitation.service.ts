import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IMailService } from '../../mail/mail.interface';
import { MAIL_SERVICE } from '../../mail/mail.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../../auth/session/token.service';
import type { CreateInvitationDto } from './dto/create-invitation.dto';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일

@Injectable()
export class InvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly config: ConfigService,
    @Inject(MAIL_SERVICE) private readonly mailService: IMailService,
  ) {}

  async send(organizationId: string, invitedById: string, dto: CreateInvitationDto): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { businessProfile: true },
    });

    if (!org || !org.businessProfile) {
      throw new NotFoundException('조직을 찾을 수 없습니다.');
    }

    const account = await this.prisma.account.findUnique({ where: { email: dto.email }, select: { userId: true } });
    if (account) {
      const member = await this.prisma.organizationMember.findUnique({
        where: { userId_organizationId: { userId: account.userId, organizationId } },
      });
      if (member?.isActive) throw new ConflictException('이미 조직의 활성 멤버입니다.');
    }

    await this.prisma.organizationInvitation.deleteMany({
      where: { email: dto.email, organizationId, acceptedAt: null },
    });

    const rawToken = this.tokenService.generateRawRefreshToken();
    const token = this.tokenService.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    await this.prisma.organizationInvitation.create({
      data: { token, email: dto.email, role: dto.role, organizationId, invitedById, expiresAt },
    });

    const clientUrl = this.config.get<string>(
      'CLIENT_URL',
      this.config.get<string>('APP_URL', 'http://localhost:5173'),
    );
    const inviteUrl = `${clientUrl}/invitations/accept?token=${rawToken}`;
    await this.mailService.sendOrganizationInvite(dto.email, inviteUrl, org.businessProfile.name);
  }

  async getByToken(rawToken: string) {
    const hashed = this.tokenService.hashToken(rawToken);
    const inv = await this.prisma.organizationInvitation.findUnique({
      where: { token: hashed },
      include: { organization: { include: { businessProfile: true } } },
    });
    if (!inv || inv.acceptedAt) throw new BadRequestException('유효하지 않은 초대입니다.');
    if (inv.expiresAt < new Date()) throw new BadRequestException('만료된 초대입니다.');
    return inv;
  }

  async accept(rawToken: string, userId: string): Promise<void> {
    const inv = await this.getByToken(rawToken);

    const existing = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId: inv.organizationId } },
    });
    if (existing) throw new ConflictException('이미 조직의 멤버입니다.');

    await this.prisma.$transaction(async (tx) => {
      await tx.organizationMember.create({
        data: {
          userId,
          organizationId: inv.organizationId,
          role: inv.role,
          name: inv.email.split('@')[0],
          isActive: true,
        },
      });
      await tx.organizationInvitation.update({
        where: { id: inv.id },
        data: { acceptedAt: new Date() },
      });
    });
  }

  // 대기 중(미수락·미만료) 초대 목록을 최신순으로 반환한다.
  async listPending(organizationId: string) {
    return this.prisma.organizationInvitation.findMany({
      where: { organizationId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: { select: { name: true } },
      },
    });
  }

  // 초대를 취소(행 삭제)한다. 조직이 다르거나 없으면 404.
  async cancel(organizationId: string, invitationId: string): Promise<void> {
    const inv = await this.prisma.organizationInvitation.findUnique({ where: { id: invitationId } });
    if (!inv || inv.organizationId !== organizationId) throw new NotFoundException('초대를 찾을 수 없습니다.');
    await this.prisma.organizationInvitation.delete({ where: { id: invitationId } });
  }

  // 초대를 재발송한다. send()가 동일 이메일의 미수락 초대를 삭제 후 새 토큰·만료로 재생성한다.
  async resend(organizationId: string, invitationId: string): Promise<void> {
    const inv = await this.prisma.organizationInvitation.findUnique({ where: { id: invitationId } });
    if (!inv || inv.organizationId !== organizationId) throw new NotFoundException('초대를 찾을 수 없습니다.');
    if (inv.acceptedAt) throw new ConflictException('이미 수락된 초대입니다.');
    await this.send(organizationId, inv.invitedById, { email: inv.email, role: inv.role });
  }
}
