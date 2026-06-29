import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateMaintenanceScheduleDto } from './dto/create-maintenance-schedule.dto';
import type { UpdateMaintenanceScheduleDto } from './dto/update-maintenance-schedule.dto';
import type { QueryMaintenanceScheduleDto } from './dto/query-maintenance-schedule.dto';

// 목록·상세 공용 include — 계약(번호+고객명)과 담당자 표시명.
const SCHEDULE_INCLUDE = {
  rentalContract: {
    select: {
      id: true,
      contractNo: true,
      rentalOrder: {
        select: {
          order: {
            select: {
              customer: {
                select: {
                  id: true,
                  individualProfile: { select: { name: true } },
                  businessPartner: { select: { businessProfile: { select: { name: true } } } },
                },
              },
            },
          },
        },
      },
    },
  },
  assignedStaff: { select: { id: true, name: true } },
} as const;

@Injectable()
export class MaintenanceScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateMaintenanceScheduleDto): Promise<{ id: string }> {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id_organizationId: { id: dto.rentalContractId, organizationId } },
      select: { id: true },
    });
    if (!contract) throw new NotFoundException('렌탈 계약을 찾을 수 없습니다.');

    if (dto.assignedStaffId) {
      const member = await this.prisma.organizationMember.findUnique({
        where: { id_organizationId: { id: dto.assignedStaffId, organizationId } },
        select: { id: true },
      });
      if (!member) throw new NotFoundException('담당 직원을 찾을 수 없습니다.');
    }

    const schedule = await this.prisma.maintenanceSchedule.create({
      data: {
        organizationId,
        rentalContractId: dto.rentalContractId,
        intervalUnit: dto.intervalUnit,
        intervalValue: dto.intervalValue,
        nextScheduledAt: new Date(dto.nextScheduledAt),
        assignedStaffId: dto.assignedStaffId ?? null,
        memo: dto.memo ?? null,
        isActive: true,
      },
      select: { id: true },
    });
    return { id: schedule.id };
  }

  findAll(organizationId: string, query: QueryMaintenanceScheduleDto) {
    const { rentalContractId, assignedStaffId, isActive, dueBefore, page = 1, limit = 20 } = query;
    return this.prisma.maintenanceSchedule.findMany({
      where: {
        organizationId,
        ...(rentalContractId && { rentalContractId }),
        ...(assignedStaffId && { assignedStaffId }),
        ...(isActive !== undefined && { isActive }),
        ...(dueBefore && { nextScheduledAt: { lte: new Date(dueBefore) } }),
      },
      include: SCHEDULE_INCLUDE,
      orderBy: { nextScheduledAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findOne(organizationId: string, id: string) {
    const schedule = await this.prisma.maintenanceSchedule.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include: SCHEDULE_INCLUDE,
    });
    if (!schedule) throw new NotFoundException('점검 일정을 찾을 수 없습니다.');
    return schedule;
  }

  async update(organizationId: string, id: string, dto: UpdateMaintenanceScheduleDto): Promise<void> {
    const schedule = await this.prisma.maintenanceSchedule.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true },
    });
    if (!schedule) throw new NotFoundException('점검 일정을 찾을 수 없습니다.');

    const data: Record<string, unknown> = {};
    if (dto.intervalUnit !== undefined) data.intervalUnit = dto.intervalUnit;
    if (dto.intervalValue !== undefined) data.intervalValue = dto.intervalValue;
    if (dto.nextScheduledAt !== undefined) data.nextScheduledAt = new Date(dto.nextScheduledAt);
    if (dto.assignedStaffId !== undefined) data.assignedStaffId = dto.assignedStaffId;
    if (dto.memo !== undefined) data.memo = dto.memo;

    await this.prisma.maintenanceSchedule.update({
      where: { id_organizationId: { id, organizationId } },

      data,
    });
  }

  async deactivate(organizationId: string, id: string): Promise<void> {
    const schedule = await this.prisma.maintenanceSchedule.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true, isActive: true },
    });
    if (!schedule) throw new NotFoundException('점검 일정을 찾을 수 없습니다.');
    if (!schedule.isActive) return;
    await this.prisma.maintenanceSchedule.update({
      where: { id_organizationId: { id, organizationId } },
      data: { isActive: false },
    });
  }
}
