import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AssetEventSourceType,
  AssetStatus,
  MaintenanceIntervalUnit,
  Prisma,
  ServiceRequestStatus,
  ServiceVisitStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetService } from '../../product/asset/asset.service';
import { InvoiceService } from '../../finance/invoice/invoice.service';
import type { CreateServiceVisitDto } from './dto/create-service-visit.dto';
import type { UpdateServiceVisitDto } from './dto/update-service-visit.dto';
import type { CompleteServiceVisitDto } from './dto/complete-service-visit.dto';

@Injectable()
export class ServiceVisitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assetService: AssetService,
    private readonly invoiceService: InvoiceService,
  ) {}

  async create(organizationId: string, requestId: string, dto: CreateServiceVisitDto): Promise<{ id: string }> {
    const serviceRequest = await this.prisma.serviceRequest.findFirst({
      where: { id: requestId, organizationId, deletedAt: null },
      select: { id: true, status: true },
    });
    if (!serviceRequest) throw new NotFoundException('AS 접수를 찾을 수 없습니다.');
    if (
      serviceRequest.status === ServiceRequestStatus.COMPLETED ||
      serviceRequest.status === ServiceRequestStatus.CANCELED
    ) {
      throw new BadRequestException('완료되거나 취소된 접수에는 방문을 등록할 수 없습니다.');
    }

    const visit = await this.prisma.serviceVisit.create({
      data: {
        organizationId,
        serviceRequestId: requestId,
        staffId: dto.staffId ?? null,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        status: ServiceVisitStatus.SCHEDULED,
        memo: dto.memo ?? null,
      },
      select: { id: true },
    });
    return { id: visit.id };
  }

  findByRequest(organizationId: string, requestId: string) {
    return this.prisma.serviceVisit.findMany({
      where: { organizationId, serviceRequestId: requestId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const visit = await this.prisma.serviceVisit.findFirst({
      where: { id, organizationId },
    });
    if (!visit) throw new NotFoundException('방문 기록을 찾을 수 없습니다.');
    return visit;
  }

  async update(organizationId: string, id: string, dto: UpdateServiceVisitDto): Promise<void> {
    const visit = await this.prisma.serviceVisit.findFirst({
      where: { id, organizationId },
      select: { id: true },
    });
    if (!visit) throw new NotFoundException('방문 기록을 찾을 수 없습니다.');
    const updateData: Prisma.ServiceVisitUpdateInput = {};
    if (dto.staffId !== undefined) updateData.staffId = dto.staffId;
    if (dto.scheduledAt !== undefined) updateData.scheduledAt = new Date(dto.scheduledAt as string);
    if (dto.memo !== undefined) updateData.memo = dto.memo;
    await this.prisma.serviceVisit.update({
      where: { id },
      data: updateData,
    });
  }

  async complete(organizationId: string, id: string, dto: CompleteServiceVisitDto, memberId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const visit = await tx.serviceVisit.findFirst({
        where: { id, organizationId },
        select: { id: true, status: true, serviceRequestId: true },
      });
      if (!visit) throw new NotFoundException('방문 기록을 찾을 수 없습니다.');
      if (visit.status === ServiceVisitStatus.COMPLETED || visit.status === ServiceVisitStatus.CANCELED) {
        throw new BadRequestException('이미 완료되거나 취소된 방문입니다.');
      }

      const visitedAt = new Date();

      await tx.serviceVisit.update({
        where: { id },
        data: {
          status: ServiceVisitStatus.COMPLETED,
          visitedAt,
          result: dto.result,
          workDescription: dto.workDescription ?? null,
          laborCost: dto.laborCost ?? null,
          partsCost: dto.partsCost ?? null,
          travelCost: dto.travelCost ?? null,
          requiresFollowUp: dto.requiresFollowUp ?? false,
          followUpNote: dto.followUpNote ?? null,
        },
      });

      const serviceRequest = await tx.serviceRequest.findFirst({
        where: { id: visit.serviceRequestId, organizationId },
        select: { assetId: true, isWarranty: true, maintenanceScheduleId: true },
      });
      if (!serviceRequest) throw new NotFoundException('AS 접수를 찾을 수 없습니다.');

      // Asset 상태 자동 업데이트
      await this.assetService.changeStatus(
        serviceRequest.assetId,
        organizationId,
        dto.assetStatusAfter ?? AssetStatus.AVAILABLE,
        AssetEventSourceType.SERVICE_VISIT,
        id,
      );

      // SERVICE_FEE Invoice 자동 생성
      const laborCost = dto.laborCost ?? 0;
      const partsCost = dto.partsCost ?? 0;
      const travelCost = dto.travelCost ?? 0;
      if (!serviceRequest.isWarranty && laborCost + partsCost + travelCost > 0) {
        await this.invoiceService.createServiceFeeInvoice(
          organizationId,
          visit.serviceRequestId,
          { laborCost, partsCost, travelCost },
          memberId,
          tx,
        );
      }

      // MaintenanceSchedule nextScheduledAt 자동 갱신
      if (serviceRequest.maintenanceScheduleId) {
        const schedule = await tx.maintenanceSchedule.findFirst({
          where: { id: serviceRequest.maintenanceScheduleId, organizationId },
          select: { intervalUnit: true, intervalValue: true },
        });
        if (schedule) {
          let nextScheduledAt: Date;
          if (schedule.intervalUnit === MaintenanceIntervalUnit.MONTH) {
            const d = new Date(visitedAt);
            d.setMonth(d.getMonth() + schedule.intervalValue);
            nextScheduledAt = d;
          } else {
            nextScheduledAt = new Date(visitedAt.getTime() + schedule.intervalValue * 24 * 60 * 60 * 1000);
          }
          await tx.maintenanceSchedule.update({
            where: { id: serviceRequest.maintenanceScheduleId },
            data: { lastInspectedAt: visitedAt, nextScheduledAt },
          });
        }
      }
    });
  }

  async cancel(organizationId: string, id: string): Promise<void> {
    const visit = await this.prisma.serviceVisit.findFirst({
      where: { id, organizationId },
      select: { id: true, status: true },
    });
    if (!visit) throw new NotFoundException('방문 기록을 찾을 수 없습니다.');
    if (visit.status === ServiceVisitStatus.COMPLETED) {
      throw new BadRequestException('완료된 방문은 취소할 수 없습니다.');
    }
    await this.prisma.serviceVisit.update({
      where: { id },
      data: { status: ServiceVisitStatus.CANCELED },
    });
  }
}
