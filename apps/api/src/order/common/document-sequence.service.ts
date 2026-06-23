import { Injectable } from '@nestjs/common';
import { DocumentSequenceType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type PrismaTransaction = Parameters<Parameters<PrismaService['$transaction']>[0]>[0];

@Injectable()
export class DocumentSequenceService {
  async generateNo(organizationId: string, type: DocumentSequenceType, tx: PrismaTransaction): Promise<string> {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dateKey = kst.toISOString().slice(0, 10).replace(/-/g, '');

    const seq = await tx.documentSequence.upsert({
      where: { organizationId_type_dateKey: { organizationId, type, dateKey } },
      update: { nextValue: { increment: 1 } },
      create: { organizationId, type, dateKey, nextValue: 1 },
    });

    return `${dateKey}-${String(seq.nextValue).padStart(4, '0')}`;
  }
}
