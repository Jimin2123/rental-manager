import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateAssignmentDto } from './dto/create-assignment.dto';
import type { UpdateAssignmentDto } from './dto/update-assignment.dto';

@Injectable()
export class AssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id_organizationId: { id: customerId, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!customer || customer.deletedAt) throw new NotFoundException('고객을 찾을 수 없습니다.');

    return this.prisma.customerAssignment.findMany({
      where: { customerId, organizationId },
      include: {
        organizationMember: { select: { id: true, name: true, role: true } },
        customerContact: { select: { id: true, name: true, department: true } },
      },
      orderBy: [{ isPrimary: 'desc' }, { startedAt: 'desc' }],
    });
  }

  async create(organizationId: string, customerId: string, dto: CreateAssignmentDto): Promise<{ id: string }> {
    const customer = await this.prisma.customer.findUnique({
      where: { id_organizationId: { id: customerId, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!customer || customer.deletedAt) throw new NotFoundException('고객을 찾을 수 없습니다.');

    const member = await this.prisma.organizationMember.findUnique({
      where: { id_organizationId: { id: dto.organizationMemberId, organizationId } },
      select: { id: true, isActive: true },
    });
    if (!member || !member.isActive) throw new NotFoundException('담당 직원을 찾을 수 없습니다.');

    const assignment = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.customerAssignment.updateMany({
          where: { customerId, organizationId, isPrimary: true, endedAt: null },
          data: { isPrimary: false },
        });
      }
      return tx.customerAssignment.create({
        data: {
          organizationId,
          customerId,
          organizationMemberId: dto.organizationMemberId,
          customerContactId: dto.customerContactId,
          individualProfileId: dto.individualProfileId,
          role: dto.role,
          isPrimary: dto.isPrimary ?? false,
          startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
          endedAt: dto.endedAt ? new Date(dto.endedAt) : undefined,
          memo: dto.memo,
        },
      });
    });
    return { id: assignment.id };
  }

  async update(organizationId: string, customerId: string, assignmentId: string, dto: UpdateAssignmentDto): Promise<void> {
    const assignment = await this.prisma.customerAssignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, customerId: true, organizationId: true },
    });
    if (!assignment || assignment.customerId !== customerId || assignment.organizationId !== organizationId) {
      throw new NotFoundException('배정을 찾을 수 없습니다.');
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.customerAssignment.updateMany({
          where: { customerId, organizationId, isPrimary: true, endedAt: null, id: { not: assignmentId } },
          data: { isPrimary: false },
        });
      }
      const data = Object.fromEntries(
        Object.entries({
          role: dto.role,
          isPrimary: dto.isPrimary,
          startedAt: dto.startedAt ? new Date(dto.startedAt) : undefined,
          endedAt: dto.endedAt ? new Date(dto.endedAt) : undefined,
          memo: dto.memo,
          customerContactId: dto.customerContactId,
        }).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(data).length) {
        await tx.customerAssignment.update({ where: { id: assignmentId }, data });
      }
    });
  }

  async remove(organizationId: string, customerId: string, assignmentId: string): Promise<void> {
    const assignment = await this.prisma.customerAssignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, customerId: true, organizationId: true },
    });
    if (!assignment || assignment.customerId !== customerId || assignment.organizationId !== organizationId) {
      throw new NotFoundException('배정을 찾을 수 없습니다.');
    }
    await this.prisma.customerAssignment.delete({ where: { id: assignmentId } });
  }
}
