import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignmentService } from './assignment.service';

describe('AssignmentService', () => {
  let service: AssignmentService;
  let prisma: {
    $transaction: jest.Mock;
    customer: { findUnique: jest.Mock };
    organizationMember: { findUnique: jest.Mock };
    customerAssignment: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
      customer: { findUnique: jest.fn() },
      organizationMember: { findUnique: jest.fn() },
      customerAssignment: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [AssignmentService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AssignmentService);
  });

  describe('list', () => {
    it('throws NotFoundException when customer not found', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.list('org-1', 'c-x')).rejects.toThrow(NotFoundException);
    });

    it('returns assignments ordered by isPrimary desc', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: null });
      prisma.customerAssignment.findMany.mockResolvedValue([{ id: 'a-1', isPrimary: true }]);

      const result = await service.list('org-1', 'c-1');

      expect(prisma.customerAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { customerId: 'c-1', organizationId: 'org-1' } }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('throws NotFoundException when customer not found', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.create('org-1', 'c-x', { organizationMemberId: 'm-1' })).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when member not found or inactive', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: null });
      prisma.organizationMember.findUnique.mockResolvedValue(null);
      await expect(service.create('org-1', 'c-1', { organizationMemberId: 'm-x' })).rejects.toThrow(NotFoundException);
    });

    it('deactivates existing primary when isPrimary is true', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: null });
      prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm-1', isActive: true });
      prisma.customerAssignment.updateMany.mockResolvedValue({ count: 1 });
      prisma.customerAssignment.create.mockResolvedValue({ id: 'a-1' });

      await service.create('org-1', 'c-1', { organizationMemberId: 'm-1', isPrimary: true });

      expect(prisma.customerAssignment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customerId: 'c-1', isPrimary: true }),
          data: { isPrimary: false },
        }),
      );
    });

    it('throws BadRequestException when individualProfileId does not match customer profile', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: null, individualProfileId: 'p-correct' });
      prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm-1', isActive: true });

      await expect(
        service.create('org-1', 'c-1', { organizationMemberId: 'm-1', individualProfileId: 'p-wrong' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates assignment and returns id', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: null });
      prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm-1', isActive: true });
      prisma.customerAssignment.create.mockResolvedValue({ id: 'a-1' });

      const result = await service.create('org-1', 'c-1', { organizationMemberId: 'm-1' });

      expect(prisma.customerAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org-1', customerId: 'c-1', organizationMemberId: 'm-1' }),
        }),
      );
      expect(result).toEqual({ id: 'a-1' });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when assignment not found', async () => {
      prisma.customerAssignment.findUnique.mockResolvedValue(null);
      await expect(service.update('org-1', 'c-1', 'a-x', {})).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when assignment belongs to different customer', async () => {
      prisma.customerAssignment.findUnique.mockResolvedValue({ id: 'a-1', customerId: 'other-c', organizationId: 'org-1' });
      await expect(service.update('org-1', 'c-1', 'a-1', {})).rejects.toThrow(NotFoundException);
    });

    it('deactivates other primaries when isPrimary is true', async () => {
      prisma.customerAssignment.findUnique.mockResolvedValue({ id: 'a-1', customerId: 'c-1', organizationId: 'org-1' });
      prisma.customerAssignment.updateMany.mockResolvedValue({ count: 1 });
      prisma.customerAssignment.update.mockResolvedValue({});

      await service.update('org-1', 'c-1', 'a-1', { isPrimary: true });

      expect(prisma.customerAssignment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { not: 'a-1' }, isPrimary: true }),
          data: { isPrimary: false },
        }),
      );
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when assignment not found', async () => {
      prisma.customerAssignment.findUnique.mockResolvedValue(null);
      await expect(service.remove('org-1', 'c-1', 'a-x')).rejects.toThrow(NotFoundException);
    });

    it('deletes assignment', async () => {
      prisma.customerAssignment.findUnique.mockResolvedValue({ id: 'a-1', customerId: 'c-1', organizationId: 'org-1' });
      prisma.customerAssignment.delete.mockResolvedValue({});

      await service.remove('org-1', 'c-1', 'a-1');

      expect(prisma.customerAssignment.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'a-1' } }),
      );
    });
  });
});
