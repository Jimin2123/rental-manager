import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MeterReadingMethod } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateMeterReadingDto } from './dto/create-meter-reading.dto';
import type { QueryMeterReadingDto } from './dto/query-meter-reading.dto';

@Injectable()
export class MeterReadingService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, assetId: string, dto: CreateMeterReadingDto): Promise<{ id: string }> {
    const asset = await this.prisma.asset.findUnique({
      where: { id_organizationId: { id: assetId, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!asset || asset.deletedAt) throw new NotFoundException('자산을 찾을 수 없습니다.');

    const prev = await this.prisma.meterReading.findFirst({
      where: { assetId, organizationId, deletedAt: null },
      orderBy: { readingDate: 'desc' },
      select: { blackCount: true, colorCount: true },
    });

    const blackUsage = dto.blackCount - (prev?.blackCount ?? 0);
    if (blackUsage < 0) throw new BadRequestException('카운터 값이 이전 검침보다 작습니다.');

    let colorUsage: number | null = null;
    if (dto.colorCount !== undefined && dto.colorCount !== null) {
      colorUsage = dto.colorCount - (prev?.colorCount ?? 0);
      if (colorUsage < 0) throw new BadRequestException('컬러 카운터 값이 이전 검침보다 작습니다.');
    }

    const reading = await this.prisma.meterReading.create({
      data: {
        organizationId,
        assetId,
        readingDate: new Date(dto.readingDate),
        blackCount: dto.blackCount,
        colorCount: dto.colorCount ?? null,
        blackUsage,
        colorUsage,
        rentalContractItemId: dto.rentalContractItemId ?? null,
        billingMonth: dto.billingMonth ?? null,
        readingMethod: dto.readingMethod ?? MeterReadingMethod.MANUAL,
        note: dto.note ?? null,
      },
    });
    return { id: reading.id };
  }

  async findByAsset(organizationId: string, assetId: string, query: QueryMeterReadingDto) {
    const asset = await this.prisma.asset.findUnique({
      where: { id_organizationId: { id: assetId, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!asset || asset.deletedAt) throw new NotFoundException('자산을 찾을 수 없습니다.');

    const { billingMonth, page = 1, limit = 20 } = query;
    return this.prisma.meterReading.findMany({
      where: {
        organizationId,
        assetId,
        deletedAt: null,
        ...(billingMonth && { billingMonth }),
      },
      orderBy: { readingDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findAll(organizationId: string, query: QueryMeterReadingDto) {
    const { assetId, billingMonth, rentalContractItemId, page = 1, limit = 20 } = query;
    return this.prisma.meterReading.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(assetId && { assetId }),
        ...(billingMonth && { billingMonth }),
        ...(rentalContractItemId && { rentalContractItemId }),
      },
      orderBy: { readingDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async cancel(organizationId: string, id: string): Promise<void> {
    const reading = await this.prisma.meterReading.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true, deletedAt: true, invoiceItemId: true },
    });
    if (!reading || reading.deletedAt) throw new NotFoundException('검침 기록을 찾을 수 없습니다.');
    if (reading.invoiceItemId) throw new BadRequestException('청구 항목에 연결된 검침은 취소할 수 없습니다.');
    await this.prisma.meterReading.update({
      where: { id_organizationId: { id, organizationId } },
      data: { deletedAt: new Date() },
    });
  }
}
