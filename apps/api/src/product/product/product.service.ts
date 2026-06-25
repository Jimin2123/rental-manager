import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateProductDto } from './dto/create-product.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import type { QueryProductDto } from './dto/query-product.dto';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateProductDto): Promise<{ id: string }> {
    const product = await this.prisma.product.create({
      data: { organizationId, ...dto },
    });
    return { id: product.id };
  }

  async findAll(organizationId: string, query: QueryProductDto) {
    const { category, isActive, search } = query;
    const products = await this.prisma.product.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(category && { category }),
        ...(isActive !== undefined && { isActive }),
        ...(search && { name: { contains: search } }),
      },
      orderBy: { createdAt: 'desc' },
    });

    const assetStatsList = await this.prisma.asset.groupBy({
      by: ['productId', 'status'],
      where: { organizationId, deletedAt: null, productId: { in: products.map((p) => p.id) } },
      _count: { status: true },
    });

    return products.map((product) => {
      const rows = assetStatsList.filter((r) => r.productId === product.id);
      const total = rows.reduce((s, r) => s + r._count.status, 0);
      const byStatus = Object.fromEntries(rows.map((r) => [r.status, r._count.status]));
      return { ...product, assetStats: { total, byStatus } };
    });
  }

  async findOne(organizationId: string, id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id_organizationId: { id, organizationId } },
    });
    if (!product || product.deletedAt) throw new NotFoundException('제품을 찾을 수 없습니다.');

    const statusCounts = await this.prisma.asset.groupBy({
      by: ['status'],
      where: { productId: id, organizationId, deletedAt: null },
      _count: { status: true },
    });
    const total = statusCounts.reduce((s, r) => s + r._count.status, 0);
    const byStatus = Object.fromEntries(statusCounts.map((r) => [r.status, r._count.status]));

    return { ...product, assetStats: { total, byStatus } };
  }

  async update(organizationId: string, id: string, dto: UpdateProductDto): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!product || product.deletedAt) throw new NotFoundException('제품을 찾을 수 없습니다.');
    await this.prisma.product.update({
      where: { id_organizationId: { id, organizationId } },
      data: dto,
    });
  }

  async softDelete(organizationId: string, id: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!product || product.deletedAt) throw new NotFoundException('제품을 찾을 수 없습니다.');

    const assetCount = await this.prisma.asset.count({
      where: { productId: id, organizationId, deletedAt: null },
    });
    if (assetCount > 0) throw new ConflictException('연결된 자산이 있어 제품을 삭제할 수 없습니다.');

    await this.prisma.product.update({
      where: { id_organizationId: { id, organizationId } },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
