import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DocumentSequenceType, ServiceRequestStatus, ServiceRequestType } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { FinanceDocumentSequenceService } from '../../finance/common/document-sequence.service';
import { ServiceRequestService } from './service-request.service';

describe('ServiceRequestService', () => {
  let service: ServiceRequestService;
  let prisma: {
    $transaction: jest.Mock;
    customer: { findUnique: jest.Mock };
    asset: { findUnique: jest.Mock };
    maintenanceSchedule: { findUnique: jest.Mock };
    rentalContractItem: { findFirst: jest.Mock };
    serviceRequest: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  };
  let docSeq: { generateNo: jest.Mock };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
      customer: { findUnique: jest.fn() },
      asset: { findUnique: jest.fn() },
      maintenanceSchedule: { findUnique: jest.fn() },
      rentalContractItem: { findFirst: jest.fn().mockResolvedValue(null) },
      serviceRequest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    docSeq = { generateNo: jest.fn().mockResolvedValue('20260624-0001') };

    const module = await Test.createTestingModule({
      providers: [
        ServiceRequestService,
        { provide: PrismaService, useValue: prisma },
        { provide: FinanceDocumentSequenceService, useValue: docSeq },
      ],
    }).compile();
    service = module.get(ServiceRequestService);
  });

  describe('create', () => {
    it('throws NotFoundException when customer not found', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(
        service.create('org-1', { type: ServiceRequestType.REPAIR, customerId: 'c-x', assetId: 'a-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when customer is deleted', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: new Date() });
      await expect(
        service.create('org-1', { type: ServiceRequestType.REPAIR, customerId: 'c-1', assetId: 'a-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when asset not found', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: null });
      prisma.asset.findUnique.mockResolvedValue(null);
      await expect(
        service.create('org-1', { type: ServiceRequestType.REPAIR, customerId: 'c-1', assetId: 'a-x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('generates requestNo via docSeq and creates service request', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: null });
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', deletedAt: null });
      prisma.serviceRequest.create.mockResolvedValue({ id: 'sr-1' });

      const result = await service.create('org-1', {
        type: ServiceRequestType.REPAIR,
        customerId: 'c-1',
        assetId: 'a-1',
      });

      expect(docSeq.generateNo).toHaveBeenCalledWith('org-1', DocumentSequenceType.SERVICE_REQUEST, prisma);
      expect(prisma.serviceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ requestNo: '20260624-0001', organizationId: 'org-1' }),
        }),
      );
      expect(result).toEqual({ id: 'sr-1' });
    });

    it('warrantyExpiresAt이 미래이면 isWarranty를 true로 자동 판단한다', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: null });
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', deletedAt: null });
      prisma.rentalContractItem.findFirst.mockResolvedValue({
        rentalOrderItem: { warrantyExpiresAt: new Date(Date.now() + 86400000) },
      });
      prisma.serviceRequest.create.mockResolvedValue({ id: 'sr-1' });

      await service.create('org-1', { type: ServiceRequestType.REPAIR, customerId: 'c-1', assetId: 'a-1' });

      expect(prisma.serviceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isWarranty: true }) }),
      );
    });

    it('warrantyExpiresAt이 과거이면 isWarranty를 false로 자동 판단한다', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: null });
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', deletedAt: null });
      prisma.rentalContractItem.findFirst.mockResolvedValue({
        rentalOrderItem: { warrantyExpiresAt: new Date(Date.now() - 86400000) },
      });
      prisma.serviceRequest.create.mockResolvedValue({ id: 'sr-1' });

      await service.create('org-1', { type: ServiceRequestType.REPAIR, customerId: 'c-1', assetId: 'a-1' });

      expect(prisma.serviceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isWarranty: false }) }),
      );
    });

    it('활성 계약 항목이 없으면 isWarranty를 false로 자동 판단한다', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: null });
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', deletedAt: null });
      prisma.rentalContractItem.findFirst.mockResolvedValue(null);
      prisma.serviceRequest.create.mockResolvedValue({ id: 'sr-1' });

      await service.create('org-1', { type: ServiceRequestType.REPAIR, customerId: 'c-1', assetId: 'a-1' });

      expect(prisma.serviceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isWarranty: false }) }),
      );
    });

    it('RETURNED 상태 계약 항목에 warrantyExpiresAt이 미래이면 isWarranty를 true로 판단한다', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: null });
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', deletedAt: null });
      prisma.rentalContractItem.findFirst.mockResolvedValue({
        rentalOrderItem: { warrantyExpiresAt: new Date(Date.now() + 86400000) },
      });
      prisma.serviceRequest.create.mockResolvedValue({ id: 'sr-1' });

      await service.create('org-1', { type: ServiceRequestType.REPAIR, customerId: 'c-1', assetId: 'a-1' });

      expect(prisma.serviceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isWarranty: true }) }),
      );
    });

    it('isWarranty를 명시적으로 전달하면 자동 판단을 무시한다', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: null });
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', deletedAt: null });
      // warrantyExpiresAt이 미래여도 DTO 값이 우선
      prisma.rentalContractItem.findFirst.mockResolvedValue({
        rentalOrderItem: { warrantyExpiresAt: new Date(Date.now() + 86400000) },
      });
      prisma.serviceRequest.create.mockResolvedValue({ id: 'sr-1' });

      await service.create('org-1', {
        type: ServiceRequestType.REPAIR,
        customerId: 'c-1',
        assetId: 'a-1',
        isWarranty: false,
      });

      expect(prisma.serviceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isWarranty: false }) }),
      );
      expect(prisma.rentalContractItem.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('changeStatus', () => {
    it('throws NotFoundException when request not found', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(null);
      await expect(service.changeStatus('org-1', 'sr-x', { status: ServiceRequestStatus.COMPLETED })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException CANCELED → COMPLETED', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        deletedAt: null,
        status: ServiceRequestStatus.CANCELED,
      });
      await expect(service.changeStatus('org-1', 'sr-1', { status: ServiceRequestStatus.COMPLETED })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException COMPLETED → CANCELED', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        deletedAt: null,
        status: ServiceRequestStatus.COMPLETED,
      });
      await expect(service.changeStatus('org-1', 'sr-1', { status: ServiceRequestStatus.CANCELED })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('updates status successfully', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        deletedAt: null,
        status: ServiceRequestStatus.RECEIVED,
      });
      prisma.serviceRequest.update.mockResolvedValue({});

      await service.changeStatus('org-1', 'sr-1', { status: ServiceRequestStatus.SCHEDULED });

      expect(prisma.serviceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: ServiceRequestStatus.SCHEDULED }) }),
      );
    });

    it('sets completedAt when status is COMPLETED', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        deletedAt: null,
        status: ServiceRequestStatus.IN_PROGRESS,
      });
      prisma.serviceRequest.update.mockResolvedValue({});

      await service.changeStatus('org-1', 'sr-1', { status: ServiceRequestStatus.COMPLETED });

      expect(prisma.serviceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ServiceRequestStatus.COMPLETED,
            completedAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('softDelete', () => {
    it('throws NotFoundException when request not found', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(null);
      await expect(service.softDelete('org-1', 'sr-x')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when status is IN_PROGRESS', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        deletedAt: null,
        status: ServiceRequestStatus.IN_PROGRESS,
      });
      await expect(service.softDelete('org-1', 'sr-1')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when status is WAITING_FOR_PARTS', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        deletedAt: null,
        status: ServiceRequestStatus.WAITING_FOR_PARTS,
      });
      await expect(service.softDelete('org-1', 'sr-1')).rejects.toThrow(ConflictException);
    });

    it('sets deletedAt on soft delete', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-1',
        deletedAt: null,
        status: ServiceRequestStatus.RECEIVED,
      });
      prisma.serviceRequest.update.mockResolvedValue({});

      await service.softDelete('org-1', 'sr-1');

      expect(prisma.serviceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date) }) }),
      );
    });
  });

  describe('findAll (목록 include)', () => {
    it('고객·자산을 include 한다', async () => {
      prisma.serviceRequest.findMany.mockResolvedValue([]);
      await service.findAll('org-1', {});
      const arg = prisma.serviceRequest.findMany.mock.calls[0][0];
      expect(arg.include.customer.select).toEqual({
        id: true,
        individualProfile: { select: { name: true } },
        businessPartner: { select: { businessProfile: { select: { name: true } } } },
      });
      expect(arg.include.asset).toEqual({
        select: { id: true, serialNumber: true, status: true, product: { select: { name: true } } },
      });
    });
  });

  describe('findOne (상세 include)', () => {
    it('고객·자산·방문(담당자 포함)을 include 한다', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue({ id: 'sr-1', deletedAt: null });
      await service.findOne('org-1', 'sr-1');
      const arg = prisma.serviceRequest.findUnique.mock.calls[0][0];
      expect(arg.include.customer.select).toEqual({
        id: true,
        individualProfile: { select: { name: true } },
        businessPartner: { select: { businessProfile: { select: { name: true } } } },
      });
      expect(arg.include.asset).toEqual({
        select: { id: true, serialNumber: true, status: true, product: { select: { name: true } } },
      });
      expect(arg.include.visits).toEqual({ include: { staff: { select: { id: true, name: true } } } });
    });
  });
});
