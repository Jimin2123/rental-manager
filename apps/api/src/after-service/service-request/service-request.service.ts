import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DocumentSequenceType, ServiceRequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceDocumentSequenceService } from '../../finance/common/document-sequence.service';
import type { CreateServiceRequestDto } from './dto/create-service-request.dto';
import type { UpdateServiceRequestDto } from './dto/update-service-request.dto';
import type { ChangeServiceRequestStatusDto } from './dto/change-service-request-status.dto';
import type { QueryServiceRequestDto } from './dto/query-service-request.dto';

@Injectable()
export class ServiceRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly docSeq: FinanceDocumentSequenceService,
  ) {}

  async create(organizationId: string, dto: CreateServiceRequestDto): Promise<{ id: string }> {
    const customer = await this.prisma.customer.findUnique({
      where: { id_organizationId: { id: dto.customerId, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!customer || customer.deletedAt) throw new NotFoundException('고객을 찾을 수 없습니다.');

    const asset = await this.prisma.asset.findUnique({
      where: { id_organizationId: { id: dto.assetId, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!asset || asset.deletedAt) throw new NotFoundException('자산을 찾을 수 없습니다.');

    if (dto.maintenanceScheduleId) {
      const schedule = await this.prisma.maintenanceSchedule.findUnique({
        where: { id_organizationId: { id: dto.maintenanceScheduleId, organizationId } },
        select: { id: true },
      });
      if (!schedule) throw new NotFoundException('점검 일정을 찾을 수 없습니다.');
    }

    return this.prisma.$transaction(async (tx) => {
      const requestNo = await this.docSeq.generateNo(organizationId, DocumentSequenceType.SERVICE_REQUEST, tx);
      const request = await tx.serviceRequest.create({
        data: {
          organizationId,
          requestNo,
          type: dto.type,
          customerId: dto.customerId,
          assetId: dto.assetId,
          isWarranty: dto.isWarranty ?? false,
          description: dto.description ?? null,
          requestedVisitDate: dto.requestedVisitDate ? new Date(dto.requestedVisitDate) : null,
          visitLocationZonecode: dto.visitLocationZonecode ?? null,
          visitLocationAddress: dto.visitLocationAddress ?? null,
          visitLocationAddressDetail: dto.visitLocationAddressDetail ?? null,
          maintenanceScheduleId: dto.maintenanceScheduleId ?? null,
          memo: dto.memo ?? null,
        },
        select: { id: true },
      });
      return { id: request.id };
    });
  }

  findAll(organizationId: string, query: QueryServiceRequestDto) {
    const { status, type, customerId, assetId, page = 1, limit = 20 } = query;
    return this.prisma.serviceRequest.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(status && { status }),
        ...(type && { type }),
        ...(customerId && { customerId }),
        ...(assetId && { assetId }),
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findOne(organizationId: string, id: string) {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include: { visits: true },
    });
    if (!request || request.deletedAt) throw new NotFoundException('AS 접수를 찾을 수 없습니다.');
    return request;
  }

  async update(organizationId: string, id: string, dto: UpdateServiceRequestDto): Promise<void> {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!request || request.deletedAt) throw new NotFoundException('AS 접수를 찾을 수 없습니다.');
    await this.prisma.serviceRequest.update({
      where: { id_organizationId: { id, organizationId } },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.requestedVisitDate !== undefined && { requestedVisitDate: new Date(dto.requestedVisitDate) }),
        ...(dto.isWarranty !== undefined && { isWarranty: dto.isWarranty }),
        ...(dto.visitLocationZonecode !== undefined && { visitLocationZonecode: dto.visitLocationZonecode }),
        ...(dto.visitLocationAddress !== undefined && { visitLocationAddress: dto.visitLocationAddress }),
        ...(dto.visitLocationAddressDetail !== undefined && {
          visitLocationAddressDetail: dto.visitLocationAddressDetail,
        }),
        ...(dto.memo !== undefined && { memo: dto.memo }),
      },
    });
  }

  async changeStatus(organizationId: string, id: string, dto: ChangeServiceRequestStatusDto): Promise<void> {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true, deletedAt: true, status: true },
    });
    if (!request || request.deletedAt) throw new NotFoundException('AS 접수를 찾을 수 없습니다.');

    if (
      request.status === ServiceRequestStatus.CANCELED &&
      dto.status === ServiceRequestStatus.COMPLETED
    ) {
      throw new BadRequestException('취소된 접수는 완료로 전환할 수 없습니다.');
    }
    if (
      request.status === ServiceRequestStatus.COMPLETED &&
      dto.status === ServiceRequestStatus.CANCELED
    ) {
      throw new BadRequestException('완료된 접수는 취소로 전환할 수 없습니다.');
    }

    await this.prisma.serviceRequest.update({
      where: { id_organizationId: { id, organizationId } },
      data: {
        status: dto.status,
        ...(dto.status === ServiceRequestStatus.COMPLETED && { completedAt: new Date() }),
      },
    });
  }

  async softDelete(organizationId: string, id: string): Promise<void> {
    const request = await this.prisma.serviceRequest.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true, deletedAt: true, status: true },
    });
    if (!request || request.deletedAt) throw new NotFoundException('AS 접수를 찾을 수 없습니다.');
    if (
      request.status === ServiceRequestStatus.IN_PROGRESS ||
      request.status === ServiceRequestStatus.WAITING_FOR_PARTS
    ) {
      throw new ConflictException('처리 중인 AS 접수는 삭제할 수 없습니다.');
    }
    await this.prisma.serviceRequest.update({
      where: { id_organizationId: { id, organizationId } },
      data: { deletedAt: new Date() },
    });
  }
}
