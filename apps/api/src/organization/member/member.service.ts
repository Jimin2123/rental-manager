import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
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
