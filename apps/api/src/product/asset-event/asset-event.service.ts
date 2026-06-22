import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AssetEventService {
  constructor(private readonly prisma: PrismaService) {}

  async findByAsset(organizationId: string, assetId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id_organizationId: { id: assetId, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!asset || asset.deletedAt) throw new NotFoundException('자산을 찾을 수 없습니다.');

    return this.prisma.assetEvent.findMany({
      where: { assetId, organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
