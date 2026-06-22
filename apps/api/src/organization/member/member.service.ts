import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AddMemberDto } from './dto/add-member.dto';
import type { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class MemberService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addDirect(organizationId: string, dto: AddMemberDto): Promise<void> {
    const account = await this.prisma.account.findUnique({ where: { email: dto.email }, select: { userId: true } });
    if (!account) throw new NotFoundException('해당 이메일로 가입된 계정이 없습니다.');

    const existing = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: account.userId, organizationId } },
    });
    if (existing) {
      if (existing.isActive) throw new ConflictException('이미 조직의 활성 멤버입니다.');
      await this.prisma.organizationMember.update({
        where: { userId_organizationId: { userId: account.userId, organizationId } },
        data: { role: dto.role, name: dto.name, department: dto.department, position: dto.position, phone: dto.memberPhone, isActive: true },
      });
      return;
    }

    await this.prisma.organizationMember.create({
      data: {
        userId: account.userId,
        organizationId,
        role: dto.role,
        name: dto.name,
        department: dto.department,
        position: dto.position,
        phone: dto.memberPhone,
        isActive: true,
      },
    });
  }

  async update(organizationId: string, memberId: string, dto: UpdateMemberDto): Promise<void> {
    const member = await this.prisma.organizationMember.findUnique({
      where: { id_organizationId: { id: memberId, organizationId } },
    });
    if (!member) throw new NotFoundException('멤버를 찾을 수 없습니다.');
    if (member.role === 'OWNER') throw new ForbiddenException('OWNER의 역할 및 정보는 변경할 수 없습니다.');

    await this.prisma.organizationMember.update({
      where: { id_organizationId: { id: memberId, organizationId } },
      data: {
        role: dto.role,
        name: dto.name,
        department: dto.department,
        position: dto.position,
        phone: dto.memberPhone,
        email: dto.memberEmail,
      },
    });
  }

  async deactivate(organizationId: string, memberId: string): Promise<void> {
    const member = await this.prisma.organizationMember.findUnique({
      where: { id_organizationId: { id: memberId, organizationId } },
    });
    if (!member) throw new NotFoundException('멤버를 찾을 수 없습니다.');
    if (member.role === 'OWNER') throw new ForbiddenException('OWNER는 비활성화할 수 없습니다.');

    await this.prisma.organizationMember.update({
      where: { id_organizationId: { id: memberId, organizationId } },
      data: { isActive: false },
    });
  }
}
