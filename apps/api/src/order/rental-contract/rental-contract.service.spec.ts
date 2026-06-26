import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AuditAction,
  AssetStatus,
  BillingTiming,
  RentalContractItemStatus,
  RentalContractStatus,
} from '@prisma/client';
import { AuditLogService } from '../../common/audit-log/audit-log.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentSequenceService } from '../common/document-sequence.service';
import { RentalContractService } from './rental-contract.service';

describe('RentalContractService', () => {
  let service: RentalContractService;
  let prisma: {
    $transaction: jest.Mock;
    rentalOrder: { findUnique: jest.Mock };
    rentalContract: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    rentalContractItem: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
    };
    asset: { findUnique: jest.Mock; update: jest.Mock };
    assetEvent: { create: jest.Mock };
  };
  let docSeq: { generateNo: jest.Mock };
  let auditLog: { log: jest.Mock };

  const mockContract = (overrides = {}) => ({
    id: 'rc-1',
    organizationId: 'org-1',
    rentalOrderId: 'ro-1',
    contractNo: '20260623-0001',
    status: RentalContractStatus.DRAFT,
    startDate: new Date('2026-07-01'),
    endDate: new Date('2027-06-30'),
    contractMonths: 12,
    billingTiming: BillingTiming.PREPAID,
    items: [],
    ...overrides,
  });

  const mockItem = (overrides = {}) => ({
    id: 'rci-1',
    organizationId: 'org-1',
    rentalContractId: 'rc-1',
    assetId: 'asset-1',
    rentalOrderItemId: null,
    status: RentalContractItemStatus.PENDING,
    monthlyRentalPrice: 100000,
    billingType: 'FIXED',
    freeBlackCount: null,
    blackUnitPrice: null,
    freeColorCount: null,
    colorUnitPrice: null,
    installationZonecode: null,
    installationAddress: null,
    installationAddressDetail: null,
    memo: null,
    startedAt: null,
    endedAt: null,
    returnedAt: null,
    replacedByItemId: null,
    replacedAt: null,
    ...overrides,
  });

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
      rentalOrder: { findUnique: jest.fn() },
      rentalContract: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      rentalContractItem: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      asset: { findUnique: jest.fn(), update: jest.fn() },
      assetEvent: { create: jest.fn() },
    };
    docSeq = { generateNo: jest.fn().mockResolvedValue('20260623-0001') };
    auditLog = { log: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        RentalContractService,
        { provide: PrismaService, useValue: prisma },
        { provide: DocumentSequenceService, useValue: docSeq },
        { provide: AuditLogService, useValue: auditLog },
      ],
    }).compile();
    service = module.get(RentalContractService);
  });

  describe('create', () => {
    it('throws NotFoundException when rentalOrder not found', async () => {
      prisma.rentalOrder.findUnique.mockResolvedValue(null);
      await expect(
        service.create('org-1', {
          rentalOrderId: 'ro-x',
          startDate: '2026-07-01',
          endDate: '2027-06-30',
          contractMonths: 12,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when contract already exists for rentalOrder', async () => {
      prisma.rentalOrder.findUnique.mockResolvedValue({ id: 'ro-1' });
      prisma.rentalContract.findUnique.mockResolvedValue({ id: 'rc-existing' });
      await expect(
        service.create('org-1', {
          rentalOrderId: 'ro-1',
          startDate: '2026-07-01',
          endDate: '2027-06-30',
          contractMonths: 12,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates contract in transaction and returns id', async () => {
      prisma.rentalOrder.findUnique.mockResolvedValue({ id: 'ro-1' });
      prisma.rentalContract.findUnique.mockResolvedValue(null);
      prisma.rentalContract.create.mockResolvedValue({ id: 'rc-1' });

      const result = await service.create('org-1', {
        rentalOrderId: 'ro-1',
        startDate: '2026-07-01',
        endDate: '2027-06-30',
        contractMonths: 12,
        billingDay: 1,
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(docSeq.generateNo).toHaveBeenCalledWith('org-1', 'RENTAL_CONTRACT', prisma);
      expect(prisma.rentalContract.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org-1', contractNo: '20260623-0001', contractMonths: 12 }),
        }),
      );
      expect(result).toEqual({ id: 'rc-1' });
    });
  });

  describe('update', () => {
    it('날짜·기간 필드는 DRAFT가 아닌 경우 BadRequestException을 던진다', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue(mockContract({ status: RentalContractStatus.ACTIVE }));
      await expect(service.update('org-1', 'rc-1', { contractMonths: 24 })).rejects.toThrow(BadRequestException);
    });

    it('ENDED 계약은 autoExpire 변경도 불가하다', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue(mockContract({ status: RentalContractStatus.ENDED }));
      await expect(service.update('org-1', 'rc-1', { autoExpire: false })).rejects.toThrow(BadRequestException);
    });

    it('updates DRAFT contract fields', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue(mockContract());
      prisma.rentalContract.update.mockResolvedValue({});

      await service.update('org-1', 'rc-1', { contractMonths: 24 });

      expect(prisma.rentalContract.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ contractMonths: 24 }) }),
      );
    });

    it('ACTIVE 계약에서 autoExpire를 false로 변경할 수 있다', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue(mockContract({ status: RentalContractStatus.ACTIVE }));
      prisma.rentalContract.update.mockResolvedValue({});

      await service.update('org-1', 'rc-1', { autoExpire: false });

      expect(prisma.rentalContract.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ autoExpire: false }) }),
      );
    });
  });

  describe('extend', () => {
    it('ACTIVE가 아닌 계약에서 BadRequestException을 던진다', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue(mockContract({ status: RentalContractStatus.DRAFT }));
      await expect(service.extend('org-1', 'rc-1', { endDate: '2028-06-30', contractMonths: 24 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('새 endDate가 현재 endDate보다 이전이면 BadRequestException을 던진다', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue(
        mockContract({ status: RentalContractStatus.ACTIVE, endDate: new Date('2027-06-30') }),
      );
      await expect(service.extend('org-1', 'rc-1', { endDate: '2026-12-31', contractMonths: 18 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('ACTIVE 계약의 endDate와 contractMonths를 연장하고 autoExpire를 재활성화한다', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue(
        mockContract({ status: RentalContractStatus.ACTIVE, endDate: new Date('2027-06-30') }),
      );
      prisma.rentalContract.update.mockResolvedValue({});

      await service.extend('org-1', 'rc-1', { endDate: '2028-06-30', contractMonths: 24 });

      expect(prisma.rentalContract.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            endDate: new Date('2028-06-30'),
            contractMonths: 24,
            autoExpire: true,
          }),
        }),
      );
    });

    it('contractMonths 미입력 시 startDate~endDate 개월 차로 자동 계산한다', async () => {
      // startDate: 2026-07-01, newEndDate: 2028-06-30 → (2028-2026)*12 + (5-6) = 23개월
      prisma.rentalContract.findUnique.mockResolvedValue(
        mockContract({
          status: RentalContractStatus.ACTIVE,
          startDate: new Date('2026-07-01'),
          endDate: new Date('2027-06-30'),
        }),
      );
      prisma.rentalContract.update.mockResolvedValue({});

      await service.extend('org-1', 'rc-1', { endDate: '2028-06-30' });

      expect(prisma.rentalContract.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            endDate: new Date('2028-06-30'),
            contractMonths: 23,
            autoExpire: true,
          }),
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('throws BadRequestException on invalid transition (ENDED → ACTIVE)', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue(mockContract({ status: RentalContractStatus.ENDED }));
      await expect(
        service.updateStatus('org-1', 'rc-1', { status: RentalContractStatus.ACTIVE }, 'mem-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when activating with no pending items', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue(mockContract({ items: [] }));
      await expect(
        service.updateStatus('org-1', 'rc-1', { status: RentalContractStatus.ACTIVE }, 'mem-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('activates contract: items PENDING→ACTIVE, asset AVAILABLE→RENTED', async () => {
      const pendingItem = mockItem();
      prisma.rentalContract.findUnique.mockResolvedValue(mockContract({ items: [pendingItem] }));
      prisma.asset.findUnique.mockResolvedValue({ status: AssetStatus.AVAILABLE });
      prisma.asset.update.mockResolvedValue({});
      prisma.assetEvent.create.mockResolvedValue({});
      prisma.rentalContractItem.update.mockResolvedValue({});
      prisma.rentalContract.update.mockResolvedValue({});

      await service.updateStatus('org-1', 'rc-1', { status: RentalContractStatus.ACTIVE }, 'mem-1');

      expect(prisma.rentalContractItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: RentalContractItemStatus.ACTIVE }) }),
      );
      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: AssetStatus.RENTED } }),
      );
      expect(prisma.rentalContract.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: RentalContractStatus.ACTIVE } }),
      );
    });

    it('ends contract: ACTIVE items → RETURNED, asset → AVAILABLE', async () => {
      const activeItem = mockItem({ status: RentalContractItemStatus.ACTIVE });
      prisma.rentalContract.findUnique.mockResolvedValue(
        mockContract({ status: RentalContractStatus.ACTIVE, items: [activeItem] }),
      );
      prisma.asset.findUnique.mockResolvedValue({ status: AssetStatus.RENTED });
      prisma.asset.update.mockResolvedValue({});
      prisma.assetEvent.create.mockResolvedValue({});
      prisma.rentalContractItem.update.mockResolvedValue({});
      prisma.rentalContract.update.mockResolvedValue({});

      await service.updateStatus('org-1', 'rc-1', { status: RentalContractStatus.ENDED }, 'mem-1');

      expect(prisma.rentalContractItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: RentalContractItemStatus.RETURNED }) }),
      );
      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: AssetStatus.AVAILABLE } }),
      );
    });

    it('cancels DRAFT contract: PENDING items → CANCELED, no asset change', async () => {
      const pendingItem = mockItem();
      prisma.rentalContract.findUnique.mockResolvedValue(mockContract({ items: [pendingItem] }));
      prisma.rentalContractItem.updateMany.mockResolvedValue({});
      prisma.rentalContract.update.mockResolvedValue({});

      await service.updateStatus('org-1', 'rc-1', { status: RentalContractStatus.CANCELED }, 'mem-1');

      expect(prisma.rentalContractItem.updateMany).toHaveBeenCalled();
      expect(prisma.asset.update).not.toHaveBeenCalled();
      expect(prisma.rentalContract.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: RentalContractStatus.CANCELED } }),
      );
    });

    it('DRAFT → ACTIVE 전환 시 STATUS_CHANGE 로그를 기록한다', async () => {
      const pendingItem = mockItem();
      prisma.rentalContract.findUnique.mockResolvedValue(mockContract({ items: [pendingItem] }));
      prisma.asset.findUnique.mockResolvedValue({ status: AssetStatus.AVAILABLE });
      prisma.asset.update.mockResolvedValue({});
      prisma.assetEvent.create.mockResolvedValue({});
      prisma.rentalContractItem.update.mockResolvedValue({});
      prisma.rentalContract.update.mockResolvedValue({});

      await service.updateStatus('org-1', 'rc-1', { status: RentalContractStatus.ACTIVE }, 'mem-1');

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          organizationId: 'org-1',
          actorId: 'mem-1',
          action: AuditAction.STATUS_CHANGE,
          targetType: 'RentalContract',
          targetId: 'rc-1',
          before: expect.objectContaining({ status: RentalContractStatus.DRAFT }),
          after: expect.objectContaining({ status: RentalContractStatus.ACTIVE }),
        }),
      );
    });

    it('ACTIVE → CANCELED 전환 시 CANCEL 로그를 기록한다', async () => {
      const activeItem = mockItem({ status: RentalContractItemStatus.ACTIVE });
      prisma.rentalContract.findUnique.mockResolvedValue(
        mockContract({ status: RentalContractStatus.ACTIVE, items: [activeItem] }),
      );
      prisma.asset.findUnique.mockResolvedValue({ status: AssetStatus.RENTED });
      prisma.asset.update.mockResolvedValue({});
      prisma.assetEvent.create.mockResolvedValue({});
      prisma.rentalContractItem.updateMany.mockResolvedValue({});
      prisma.rentalContract.update.mockResolvedValue({});

      await service.updateStatus('org-1', 'rc-1', { status: RentalContractStatus.CANCELED }, 'mem-1');

      expect(auditLog.log).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: AuditAction.CANCEL,
          targetType: 'RentalContract',
          targetId: 'rc-1',
        }),
      );
    });
  });

  describe('addItem', () => {
    it('throws BadRequestException when contract is not DRAFT', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue({ status: RentalContractStatus.ACTIVE });
      await expect(service.addItem('org-1', 'rc-1', { assetId: 'a-1', monthlyRentalPrice: 100000 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException when asset not found', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue({ status: RentalContractStatus.DRAFT });
      prisma.asset.findUnique.mockResolvedValue(null);
      await expect(service.addItem('org-1', 'rc-1', { assetId: 'a-x', monthlyRentalPrice: 100000 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when asset is not AVAILABLE', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue({ status: RentalContractStatus.DRAFT });
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', status: AssetStatus.RENTED, deletedAt: null });
      await expect(service.addItem('org-1', 'rc-1', { assetId: 'a-1', monthlyRentalPrice: 100000 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates item and returns id', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue({ status: RentalContractStatus.DRAFT });
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', status: AssetStatus.AVAILABLE, deletedAt: null });
      prisma.rentalContractItem.create.mockResolvedValue({ id: 'rci-1' });

      const result = await service.addItem('org-1', 'rc-1', {
        assetId: 'a-1',
        monthlyRentalPrice: 100000,
      });

      expect(result).toEqual({ id: 'rci-1' });
    });
  });

  describe('removeItem', () => {
    it('throws BadRequestException when item is ACTIVE', async () => {
      prisma.rentalContractItem.findFirst.mockResolvedValue(mockItem({ status: RentalContractItemStatus.ACTIVE }));
      await expect(service.removeItem('org-1', 'rc-1', 'rci-1')).rejects.toThrow(BadRequestException);
    });

    it('deletes PENDING item', async () => {
      prisma.rentalContractItem.findFirst.mockResolvedValue(mockItem());
      prisma.rentalContractItem.delete.mockResolvedValue({});

      await service.removeItem('org-1', 'rc-1', 'rci-1');

      expect(prisma.rentalContractItem.delete).toHaveBeenCalledWith({ where: { id: 'rci-1' } });
    });
  });

  describe('replaceItem', () => {
    it('throws BadRequestException when contract is not ACTIVE', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue({ status: RentalContractStatus.DRAFT });
      await expect(service.replaceItem('org-1', 'rc-1', 'rci-1', { newAssetId: 'a-new' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when item is not ACTIVE', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue({ status: RentalContractStatus.ACTIVE });
      prisma.rentalContractItem.findFirst.mockResolvedValue(mockItem({ status: RentalContractItemStatus.RETURNED }));
      await expect(service.replaceItem('org-1', 'rc-1', 'rci-1', { newAssetId: 'a-new' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when new asset is not AVAILABLE', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue({ status: RentalContractStatus.ACTIVE });
      prisma.rentalContractItem.findFirst.mockResolvedValue(mockItem({ status: RentalContractItemStatus.ACTIVE }));
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-new', status: AssetStatus.RENTED, deletedAt: null });
      await expect(service.replaceItem('org-1', 'rc-1', 'rci-1', { newAssetId: 'a-new' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('creates new item, marks old REPLACED, swaps asset states', async () => {
      const activeItem = mockItem({ status: RentalContractItemStatus.ACTIVE });
      prisma.rentalContract.findUnique.mockResolvedValue({ status: RentalContractStatus.ACTIVE });
      prisma.rentalContractItem.findFirst.mockResolvedValue(activeItem);
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-new', status: AssetStatus.AVAILABLE, deletedAt: null });
      prisma.rentalContractItem.create.mockResolvedValue({ id: 'rci-new' });
      prisma.rentalContractItem.update.mockResolvedValue({});
      prisma.asset.update.mockResolvedValue({});
      prisma.assetEvent.create.mockResolvedValue({});

      const result = await service.replaceItem('org-1', 'rc-1', 'rci-1', {
        newAssetId: 'a-new',
        monthlyRentalPrice: 120000,
      });

      expect(prisma.rentalContractItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assetId: 'a-new',
            status: RentalContractItemStatus.ACTIVE,
            monthlyRentalPrice: 120000,
          }),
        }),
      );
      expect(prisma.rentalContractItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: RentalContractItemStatus.REPLACED, replacedByItemId: 'rci-new' }),
        }),
      );
      expect(prisma.asset.update).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ id: 'rci-new' });
    });
  });

  describe('returnItem', () => {
    it('throws BadRequestException when contract is not ACTIVE', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue({ status: RentalContractStatus.ENDED });
      await expect(service.returnItem('org-1', 'rc-1', 'rci-1', {})).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when item is not ACTIVE', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue({ status: RentalContractStatus.ACTIVE });
      prisma.rentalContractItem.findFirst.mockResolvedValue(mockItem({ status: RentalContractItemStatus.RETURNED }));
      await expect(service.returnItem('org-1', 'rc-1', 'rci-1', {})).rejects.toThrow(BadRequestException);
    });

    it('marks item RETURNED and releases asset', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue({ status: RentalContractStatus.ACTIVE });
      prisma.rentalContractItem.findFirst.mockResolvedValue(mockItem({ status: RentalContractItemStatus.ACTIVE }));
      prisma.asset.findUnique.mockResolvedValue({ status: AssetStatus.RENTED });
      prisma.asset.update.mockResolvedValue({});
      prisma.assetEvent.create.mockResolvedValue({});
      prisma.rentalContractItem.update.mockResolvedValue({});

      await service.returnItem('org-1', 'rc-1', 'rci-1', { note: '정상 회수' });

      expect(prisma.rentalContractItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: RentalContractItemStatus.RETURNED }),
        }),
      );
      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: AssetStatus.AVAILABLE } }),
      );
    });
  });
});
