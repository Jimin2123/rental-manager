import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentSequenceService } from './document-sequence.service';

describe('DocumentSequenceService', () => {
  let service: DocumentSequenceService;
  let prisma: { documentSequence: { upsert: jest.Mock } };

  beforeEach(async () => {
    prisma = { documentSequence: { upsert: jest.fn() } };
    const module = await Test.createTestingModule({
      providers: [DocumentSequenceService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(DocumentSequenceService);
  });

  it('generates YYYYMMDD-XXXX format', async () => {
    prisma.documentSequence.upsert.mockResolvedValue({ nextValue: 1 });
    const no = await service.generateNo('org-1', 'ORDER', prisma as any);
    expect(no).toMatch(/^\d{8}-0001$/);
  });

  it('pads sequence to 4 digits', async () => {
    prisma.documentSequence.upsert.mockResolvedValue({ nextValue: 42 });
    const no = await service.generateNo('org-1', 'QUOTATION', prisma as any);
    expect(no).toMatch(/^\d{8}-0042$/);
  });

  it('passes correct upsert args', async () => {
    prisma.documentSequence.upsert.mockResolvedValue({ nextValue: 1 });
    await service.generateNo('org-1', 'ORDER', prisma as any);
    expect(prisma.documentSequence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { nextValue: { increment: 1 } },
        create: expect.objectContaining({ organizationId: 'org-1', type: 'ORDER', nextValue: 1 }),
      }),
    );
  });
});
