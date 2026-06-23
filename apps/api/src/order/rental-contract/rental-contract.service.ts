import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetEventSourceType, AssetStatus, RentalContractItemStatus, RentalContractStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentSequenceService } from '../common/document-sequence.service';
import { CreateRentalContractDto } from './dto/create-rental-contract.dto';
import { CreateRentalContractItemDto } from './dto/create-rental-contract-item.dto';
import { ExtendRentalContractDto } from './dto/extend-rental-contract.dto';
import { ReplaceRentalContractItemDto } from './dto/replace-rental-contract-item.dto';
import { ReturnRentalContractItemDto } from './dto/return-rental-contract-item.dto';
import { UpdateRentalContractDto } from './dto/update-rental-contract.dto';
import { UpdateRentalContractItemDto } from './dto/update-rental-contract-item.dto';
import { UpdateRentalContractStatusDto } from './dto/update-rental-contract-status.dto';

type PrismaTransaction = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

const CONTRACT_TRANSITIONS: Record<RentalContractStatus, RentalContractStatus[]> = {
  [RentalContractStatus.DRAFT]: [RentalContractStatus.ACTIVE, RentalContractStatus.CANCELED],
  [RentalContractStatus.ACTIVE]: [RentalContractStatus.ENDED, RentalContractStatus.CANCELED],
  [RentalContractStatus.ENDED]: [],
  [RentalContractStatus.CANCELED]: [],
};

@Injectable()
export class RentalContractService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly docSeq: DocumentSequenceService,
  ) {}

  async create(organizationId: string, dto: CreateRentalContractDto) {
    const rentalOrder = await this.prisma.rentalOrder.findUnique({
      where: { id_organizationId: { id: dto.rentalOrderId, organizationId } },
    });
    if (!rentalOrder) throw new NotFoundException('렌탈 주문을 찾을 수 없습니다.');

    const existing = await this.prisma.rentalContract.findUnique({
      where: { rentalOrderId_organizationId: { rentalOrderId: dto.rentalOrderId, organizationId } },
    });
    if (existing) throw new ConflictException('이미 이 주문에 연결된 계약이 존재합니다.');

    const contract = await this.prisma.$transaction(async (tx) => {
      const contractNo = await this.docSeq.generateNo(organizationId, 'RENTAL_CONTRACT', tx);
      return tx.rentalContract.create({
        data: {
          organizationId,
          rentalOrderId: dto.rentalOrderId,
          contractNo,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          contractMonths: dto.contractMonths,
          billingDay: dto.billingDay,
          paymentDueDay: dto.paymentDueDay,
          billingTiming: dto.billingTiming,
        },
        select: { id: true },
      });
    });

    return { id: contract.id };
  }

  findAll(organizationId: string) {
    return this.prisma.rentalContract.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: { rentalOrder: { include: { order: true } } },
    });
  }

  async findOne(organizationId: string, id: string) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include: {
        rentalOrder: { include: { order: true, items: true } },
        items: { include: { asset: true } },
      },
    });
    if (!contract) throw new NotFoundException('계약을 찾을 수 없습니다.');
    return contract;
  }

  async update(organizationId: string, id: string, dto: UpdateRentalContractDto) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { status: true },
    });
    if (!contract) throw new NotFoundException('계약을 찾을 수 없습니다.');

    const isTerminal =
      contract.status === RentalContractStatus.ENDED || contract.status === RentalContractStatus.CANCELED;
    if (isTerminal) throw new BadRequestException('종료되거나 취소된 계약은 수정할 수 없습니다.');

    const hasDraftOnlyFields =
      dto.startDate !== undefined ||
      dto.endDate !== undefined ||
      dto.contractMonths !== undefined ||
      dto.billingDay !== undefined ||
      dto.paymentDueDay !== undefined ||
      dto.billingTiming !== undefined;

    if (hasDraftOnlyFields && contract.status !== RentalContractStatus.DRAFT)
      throw new BadRequestException('날짜·기간·청구 설정은 DRAFT 상태의 계약만 수정할 수 있습니다.');

    await this.prisma.rentalContract.update({
      where: { id_organizationId: { id, organizationId } },
      data: {
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
        ...(dto.contractMonths !== undefined && { contractMonths: dto.contractMonths }),
        ...(dto.billingDay !== undefined && { billingDay: dto.billingDay }),
        ...(dto.paymentDueDay !== undefined && { paymentDueDay: dto.paymentDueDay }),
        ...(dto.billingTiming !== undefined && { billingTiming: dto.billingTiming }),
        ...(dto.autoExpire !== undefined && { autoExpire: dto.autoExpire }),
      },
    });
  }

  async extend(organizationId: string, id: string, dto: ExtendRentalContractDto) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { status: true, endDate: true },
    });
    if (!contract) throw new NotFoundException('계약을 찾을 수 없습니다.');
    if (contract.status !== RentalContractStatus.ACTIVE)
      throw new BadRequestException('ACTIVE 상태의 계약만 기간 연장할 수 있습니다.');

    const newEndDate = new Date(dto.endDate);
    if (newEndDate <= contract.endDate) throw new BadRequestException('연장 종료일은 현재 종료일보다 이후여야 합니다.');

    await this.prisma.rentalContract.update({
      where: { id_organizationId: { id, organizationId } },
      data: { endDate: newEndDate, contractMonths: dto.contractMonths },
    });
  }

  async updateStatus(organizationId: string, id: string, dto: UpdateRentalContractStatusDto) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include: { items: true },
    });
    if (!contract) throw new NotFoundException('계약을 찾을 수 없습니다.');

    const allowed = CONTRACT_TRANSITIONS[contract.status];
    if (!allowed.includes(dto.status))
      throw new BadRequestException(`${contract.status} 상태에서 ${dto.status}로 전환할 수 없습니다.`);

    if (dto.status === RentalContractStatus.ACTIVE) {
      const pendingItems = contract.items.filter((i) => i.status === RentalContractItemStatus.PENDING);
      if (pendingItems.length === 0) throw new BadRequestException('계약 활성화를 위한 장비 항목이 없습니다.');

      await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        for (const item of pendingItems) {
          await tx.rentalContractItem.update({
            where: { id: item.id },
            data: { status: RentalContractItemStatus.ACTIVE, startedAt: now },
          });
          await this.changeAssetStatus(tx, item.assetId, organizationId, AssetStatus.RENTED, id);
        }
        await tx.rentalContract.update({
          where: { id_organizationId: { id, organizationId } },
          data: { status: RentalContractStatus.ACTIVE },
        });
      });
    } else if (dto.status === RentalContractStatus.ENDED) {
      const activeItems = contract.items.filter((i) => i.status === RentalContractItemStatus.ACTIVE);

      await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        for (const item of activeItems) {
          await tx.rentalContractItem.update({
            where: { id: item.id },
            data: { status: RentalContractItemStatus.RETURNED, endedAt: now, returnedAt: now },
          });
          await this.changeAssetStatus(tx, item.assetId, organizationId, AssetStatus.AVAILABLE, id);
        }
        await tx.rentalContract.update({
          where: { id_organizationId: { id, organizationId } },
          data: { status: RentalContractStatus.ENDED },
        });
      });
    } else if (dto.status === RentalContractStatus.CANCELED) {
      const activeItems = contract.items.filter((i) => i.status === RentalContractItemStatus.ACTIVE);

      await this.prisma.$transaction(async (tx) => {
        // ACTIVE 아이템의 Asset 반환
        for (const item of activeItems) {
          await this.changeAssetStatus(tx, item.assetId, organizationId, AssetStatus.AVAILABLE, id);
        }
        // 모든 비완료 아이템 CANCELED
        const incompleteStatuses: RentalContractItemStatus[] = [
          RentalContractItemStatus.PENDING,
          RentalContractItemStatus.ACTIVE,
        ];
        await tx.rentalContractItem.updateMany({
          where: { rentalContractId: id, organizationId, status: { in: incompleteStatuses } },
          data: { status: RentalContractItemStatus.CANCELED },
        });
        await tx.rentalContract.update({
          where: { id_organizationId: { id, organizationId } },
          data: { status: RentalContractStatus.CANCELED },
        });
      });
    }
  }

  async addItem(organizationId: string, contractId: string, dto: CreateRentalContractItemDto) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id_organizationId: { id: contractId, organizationId } },
      select: { status: true },
    });
    if (!contract) throw new NotFoundException('계약을 찾을 수 없습니다.');
    if (contract.status !== RentalContractStatus.DRAFT)
      throw new BadRequestException('DRAFT 상태의 계약에만 항목을 추가할 수 있습니다.');

    const asset = await this.prisma.asset.findUnique({
      where: { id_organizationId: { id: dto.assetId, organizationId } },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!asset || asset.deletedAt) throw new NotFoundException('자산을 찾을 수 없습니다.');
    if (asset.status !== AssetStatus.AVAILABLE)
      throw new BadRequestException('AVAILABLE 상태의 자산만 계약에 추가할 수 있습니다.');

    const item = await this.prisma.rentalContractItem.create({
      data: {
        organizationId,
        rentalContractId: contractId,
        assetId: dto.assetId,
        rentalOrderItemId: dto.rentalOrderItemId,
        monthlyRentalPrice: dto.monthlyRentalPrice,
        billingType: dto.billingType,
        freeBlackCount: dto.freeBlackCount,
        blackUnitPrice: dto.blackUnitPrice,
        freeColorCount: dto.freeColorCount,
        colorUnitPrice: dto.colorUnitPrice,
        installationZonecode: dto.installationZonecode,
        installationAddress: dto.installationAddress,
        installationAddressDetail: dto.installationAddressDetail,
        memo: dto.memo,
      },
      select: { id: true },
    });

    return { id: item.id };
  }

  async updateItem(organizationId: string, contractId: string, itemId: string, dto: UpdateRentalContractItemDto) {
    const item = await this.findItem(organizationId, contractId, itemId);
    if (item.status !== RentalContractItemStatus.PENDING)
      throw new BadRequestException('PENDING 상태의 항목만 수정할 수 있습니다.');

    await this.prisma.rentalContractItem.update({
      where: { id: itemId },
      data: dto,
    });
  }

  async removeItem(organizationId: string, contractId: string, itemId: string) {
    const item = await this.findItem(organizationId, contractId, itemId);
    if (item.status !== RentalContractItemStatus.PENDING)
      throw new BadRequestException('PENDING 상태의 항목만 삭제할 수 있습니다.');

    await this.prisma.rentalContractItem.delete({ where: { id: itemId } });
  }

  async replaceItem(organizationId: string, contractId: string, itemId: string, dto: ReplaceRentalContractItemDto) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id_organizationId: { id: contractId, organizationId } },
      select: { status: true },
    });
    if (!contract) throw new NotFoundException('계약을 찾을 수 없습니다.');
    if (contract.status !== RentalContractStatus.ACTIVE)
      throw new BadRequestException('ACTIVE 상태의 계약에서만 교체할 수 있습니다.');

    const oldItem = await this.findItem(organizationId, contractId, itemId);
    if (oldItem.status !== RentalContractItemStatus.ACTIVE)
      throw new BadRequestException('ACTIVE 상태의 항목만 교체할 수 있습니다.');

    const newAsset = await this.prisma.asset.findUnique({
      where: { id_organizationId: { id: dto.newAssetId, organizationId } },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!newAsset || newAsset.deletedAt) throw new NotFoundException('교체할 자산을 찾을 수 없습니다.');
    if (newAsset.status !== AssetStatus.AVAILABLE)
      throw new BadRequestException('AVAILABLE 상태의 자산으로만 교체할 수 있습니다.');

    const newItemId = await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      const newItem = await tx.rentalContractItem.create({
        data: {
          organizationId,
          rentalContractId: contractId,
          assetId: dto.newAssetId,
          rentalOrderItemId: oldItem.rentalOrderItemId,
          monthlyRentalPrice: dto.monthlyRentalPrice ?? oldItem.monthlyRentalPrice,
          billingType: oldItem.billingType,
          freeBlackCount: oldItem.freeBlackCount,
          blackUnitPrice: oldItem.blackUnitPrice,
          freeColorCount: oldItem.freeColorCount,
          colorUnitPrice: oldItem.colorUnitPrice,
          installationZonecode: oldItem.installationZonecode,
          installationAddress: oldItem.installationAddress,
          installationAddressDetail: oldItem.installationAddressDetail,
          status: RentalContractItemStatus.ACTIVE,
          startedAt: now,
          memo: dto.note,
        },
        select: { id: true },
      });

      await tx.rentalContractItem.update({
        where: { id: itemId },
        data: {
          status: RentalContractItemStatus.REPLACED,
          replacedByItemId: newItem.id,
          replacedAt: now,
          endedAt: now,
        },
      });

      // 기존 자산 반환
      await this.changeAssetStatus(tx, oldItem.assetId, organizationId, AssetStatus.AVAILABLE, contractId);
      // 새 자산 점유
      await this.changeAssetStatus(tx, dto.newAssetId, organizationId, AssetStatus.RENTED, contractId);

      return newItem.id;
    });

    return { id: newItemId };
  }

  async returnItem(organizationId: string, contractId: string, itemId: string, dto: ReturnRentalContractItemDto) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id_organizationId: { id: contractId, organizationId } },
      select: { status: true },
    });
    if (!contract) throw new NotFoundException('계약을 찾을 수 없습니다.');
    if (contract.status !== RentalContractStatus.ACTIVE)
      throw new BadRequestException('ACTIVE 상태의 계약에서만 회수할 수 있습니다.');

    const item = await this.findItem(organizationId, contractId, itemId);
    if (item.status !== RentalContractItemStatus.ACTIVE)
      throw new BadRequestException('ACTIVE 상태의 항목만 회수할 수 있습니다.');

    await this.prisma.$transaction(async (tx) => {
      const returnedAt = dto.returnedAt ? new Date(dto.returnedAt) : new Date();
      await tx.rentalContractItem.update({
        where: { id: itemId },
        data: { status: RentalContractItemStatus.RETURNED, returnedAt, endedAt: returnedAt },
      });
      await this.changeAssetStatus(tx, item.assetId, organizationId, AssetStatus.AVAILABLE, contractId, dto.note);
    });
  }

  private async findItem(organizationId: string, contractId: string, itemId: string) {
    const item = await this.prisma.rentalContractItem.findFirst({
      where: { id: itemId, rentalContractId: contractId, organizationId },
    });
    if (!item) throw new NotFoundException('계약 항목을 찾을 수 없습니다.');
    return item;
  }

  private async changeAssetStatus(
    tx: PrismaTransaction,
    assetId: string,
    organizationId: string,
    toStatus: AssetStatus,
    sourceId: string,
    note?: string,
  ) {
    const asset = await tx.asset.findUnique({
      where: { id_organizationId: { id: assetId, organizationId } },
      select: { status: true },
    });
    if (!asset) throw new NotFoundException('자산을 찾을 수 없습니다.');

    await tx.asset.update({
      where: { id_organizationId: { id: assetId, organizationId } },
      data: { status: toStatus },
    });
    await tx.assetEvent.create({
      data: {
        organizationId,
        assetId,
        fromStatus: asset.status,
        toStatus,
        sourceType: AssetEventSourceType.RENTAL_CONTRACT,
        sourceId,
        note,
      },
    });
  }
}
