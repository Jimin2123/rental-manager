import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetEventSourceType, AssetStatus, BusinessPartnerRoleType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateAssetDto } from './dto/create-asset.dto';
import type { UpdateAssetDto } from './dto/update-asset.dto';
import type { QueryAssetDto } from './dto/query-asset.dto';

@Injectable()
export class AssetService {
  constructor(private readonly prisma: PrismaService) {}

  private async validateSupplier(organizationId: string, supplierId: string): Promise<void> {
    const role = await this.prisma.businessPartnerRole.findFirst({
      where: { businessPartnerId: supplierId, organizationId, type: BusinessPartnerRoleType.PURCHASE },
      select: { id: true },
    });
    if (!role) throw new BadRequestException('매입 거래처로 등록되지 않은 거래처입니다.');
  }

  async create(organizationId: string, dto: CreateAssetDto): Promise<{ id: string }> {
    const product = await this.prisma.product.findUnique({
      where: { id_organizationId: { id: dto.productId, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!product) throw new NotFoundException('제품을 찾을 수 없습니다.');
    if (product.deletedAt) throw new BadRequestException('삭제된 제품에는 자산을 등록할 수 없습니다.');

    if (dto.supplierId) await this.validateSupplier(organizationId, dto.supplierId);

    try {
      const asset = await this.prisma.$transaction(async (tx) => {
        const created = await tx.asset.create({
          data: {
            organizationId,
            productId: dto.productId,
            serialNumber: dto.serialNumber,
            status: dto.initialStatus,
            supplierId: dto.supplierId,
            purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
            purchasePrice: dto.purchasePrice,
            memo: dto.memo,
          },
        });
        await tx.assetEvent.create({
          data: {
            organizationId,
            assetId: created.id,
            fromStatus: null,
            toStatus: dto.initialStatus,
            sourceType: AssetEventSourceType.MANUAL,
          },
        });
        return created;
      });
      return { id: asset.id };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('이미 등록된 시리얼 번호입니다.');
      }
      throw e;
    }
  }

  async findAll(organizationId: string, query: QueryAssetDto) {
    const { productId, status, search } = query;
    return this.prisma.asset.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(productId && { productId }),
        ...(status && { status }),
        ...(search && { serialNumber: { contains: search } }),
      },
      include: {
        product: { select: { id: true, name: true, manufacturer: true, modelName: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include: {
        product: { select: { id: true, name: true, manufacturer: true, modelName: true, category: true } },
        supplier: { select: { id: true, businessProfile: { select: { name: true, businessRegistrationNo: true } } } },
      },
    });
    if (!asset || asset.deletedAt) throw new NotFoundException('자산을 찾을 수 없습니다.');
    return asset;
  }

  async update(organizationId: string, id: string, dto: UpdateAssetDto): Promise<void> {
    const asset = await this.prisma.asset.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!asset || asset.deletedAt) throw new NotFoundException('자산을 찾을 수 없습니다.');

    if (dto.supplierId) await this.validateSupplier(organizationId, dto.supplierId);

    try {
      await this.prisma.asset.update({
        where: { id_organizationId: { id, organizationId } },
        data: {
          ...(dto.serialNumber !== undefined && { serialNumber: dto.serialNumber }),
          ...(dto.supplierId !== undefined && { supplierId: dto.supplierId }),
          ...(dto.purchaseDate !== undefined && { purchaseDate: new Date(dto.purchaseDate) }),
          ...(dto.purchasePrice !== undefined && { purchasePrice: dto.purchasePrice }),
          ...(dto.memo !== undefined && { memo: dto.memo }),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('이미 등록된 시리얼 번호입니다.');
      }
      throw e;
    }
  }

  async changeStatus(
    assetId: string,
    organizationId: string,
    toStatus: AssetStatus,
    sourceType: AssetEventSourceType,
    sourceId?: string,
    note?: string,
  ): Promise<void> {
    const asset = await this.prisma.asset.findUnique({
      where: { id_organizationId: { id: assetId, organizationId } },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!asset || asset.deletedAt) throw new NotFoundException('자산을 찾을 수 없습니다.');
    if (asset.status === toStatus) return;

    await this.prisma.$transaction(async (tx) => {
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
          sourceType,
          sourceId,
          note,
        },
      });
    });
  }

  async softDelete(organizationId: string, id: string): Promise<void> {
    const asset = await this.prisma.asset.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!asset || asset.deletedAt) throw new NotFoundException('자산을 찾을 수 없습니다.');
    if (asset.status === AssetStatus.RENTED) throw new ConflictException('렌탈 중인 자산은 삭제할 수 없습니다.');
    await this.prisma.asset.update({
      where: { id_organizationId: { id, organizationId } },
      data: { deletedAt: new Date() },
    });
  }
}
