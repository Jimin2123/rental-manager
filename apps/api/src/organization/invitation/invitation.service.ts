import * as bcrypt from 'bcrypt';
import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OrganizationMemberRole } from '@prisma/client';
import type { IMailService } from '../../mail/mail.interface';
import { MAIL_SERVICE } from '../../mail/mail.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../../auth/session/token.service';
import type { CreateInvitationDto } from './dto/create-invitation.dto';
import type { SignupAcceptDto } from './dto/signup-accept.dto';

const BCRYPT_ROUNDS = 12;

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
    await this.createMembership(inv.organizationId, userId, inv.role, inv.email, inv.id);
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

  // 내 이메일로 온 대기 초대(미수락·미거절·미만료)
  async listMine(email: string) {
    return this.prisma.organizationInvitation.findMany({
      where: { email, acceptedAt: null, declinedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        role: true,
        expiresAt: true,
        organization: { select: { businessProfile: { select: { name: true } } } },
        invitedBy: { select: { name: true } },
      },
    });
  }

  // 내 이메일로 온 대기 초대인지 확인하고 반환(아니면 404)
  private async getMinePending(invitationId: string, email: string) {
    const inv = await this.prisma.organizationInvitation.findUnique({ where: { id: invitationId } });
    if (!inv || inv.email !== email) throw new NotFoundException('초대를 찾을 수 없습니다.');
    if (inv.acceptedAt) throw new ConflictException('이미 수락한 초대입니다.');
    if (inv.declinedAt) throw new ConflictException('이미 거절한 초대입니다.');
    if (inv.expiresAt < new Date()) throw new BadRequestException('만료된 초대입니다.');
    return inv;
  }

  // 인앱: 내 초대 수락(현재 로그인 계정으로 합류)
  async acceptById(invitationId: string, email: string, userId: string): Promise<void> {
    const inv = await this.getMinePending(invitationId, email);
    await this.createMembership(inv.organizationId, userId, inv.role, inv.email, inv.id);
  }

  // 인앱: 내 초대 거절
  async declineById(invitationId: string, email: string): Promise<void> {
    const inv = await this.getMinePending(invitationId, email);
    await this.prisma.organizationInvitation.update({ where: { id: inv.id }, data: { declinedAt: new Date() } });
  }

  // 메일 링크: 토큰으로 거절(비로그인 가능)
  async declineByToken(rawToken: string): Promise<void> {
    const inv = await this.getByToken(rawToken); // 만료/이미수락이면 여기서 BadRequest
    await this.prisma.organizationInvitation.update({ where: { id: inv.id }, data: { declinedAt: new Date() } });
  }

  // 멤버 생성 + 초대 수락 처리(트랜잭션). 이미 멤버면 409.
  private async createMembership(organizationId: string, userId: string, role: OrganizationMemberRole, email: string, invitationId: string): Promise<void> {
    const existing = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (existing?.isActive) throw new ConflictException('이미 조직의 멤버입니다.');
    await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.organizationMember.update({
          where: { userId_organizationId: { userId, organizationId } },
          data: { role, isActive: true },
        });
      } else {
        await tx.organizationMember.create({
          data: { userId, organizationId, role, name: email.split('@')[0], isActive: true },
        });
      }
      await tx.organizationInvitation.update({ where: { id: invitationId }, data: { acceptedAt: new Date() } });
    });
  }

  // 미가입자: 원샷 가입 + 토큰 수락. 세션용 평문 토큰은 컨트롤러가 발급하도록 userId 등을 반환.
  async signupAccept(rawToken: string, dto: SignupAcceptDto): Promise<{ userId: string; accountId: string; organizationId: string }> {
    const inv = await this.getByToken(rawToken);
    const dup = await this.prisma.account.findUnique({ where: { email: dto.email }, select: { id: true } });
    if (dup) throw new ConflictException('이미 가입된 이메일입니다. 로그인 후 수락하세요.');
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { type: 'PERSONAL' } });
      const account = await tx.account.create({ data: { userId: user.id, email: dto.email, passwordHash } });
      await tx.passwordHistory.create({ data: { accountId: account.id, passwordHash } });
      await tx.organizationMember.create({
        data: { userId: user.id, organizationId: inv.organizationId, role: inv.role, name: dto.memberName, isActive: true },
      });
      await tx.organizationInvitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
      return { userId: user.id, accountId: account.id, organizationId: inv.organizationId };
    });
  }

  // 보낸 초대 중 최근 7일 내 수락/거절된 건(헤더 종 알림용)
  async sentRecent(memberId: string) {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.organizationInvitation.findMany({
      where: {
        invitedById: memberId,
        OR: [{ acceptedAt: { gt: since } }, { declinedAt: { gt: since } }],
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, role: true, acceptedAt: true, declinedAt: true },
    });
    return rows.map((r) => ({ ...r, result: r.acceptedAt ? 'ACCEPTED' : ('DECLINED' as const) }));
  }

  // 관리자 목록: 수락 제외, 대기/거절/만료 포함 + 파생 status
  async listForAdmin(organizationId: string) {
    const rows = await this.prisma.organizationInvitation.findMany({
      where: { organizationId, acceptedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, role: true, expiresAt: true, declinedAt: true, createdAt: true, invitedBy: { select: { name: true } } },
    });
    const now = new Date();
    return rows.map((r) => ({
      ...r,
      status: r.declinedAt ? 'DECLINED' : r.expiresAt < now ? 'EXPIRED' : 'PENDING',
    }));
  }
}
