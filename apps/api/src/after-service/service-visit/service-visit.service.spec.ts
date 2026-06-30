import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  AssetEventSourceType,
  AssetStatus,
  ServiceRequestStatus,
  ServiceVisitResult,
  ServiceVisitStatus,
} from '@prisma/client';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetService } from '../../product/asset/asset.service';
import { InvoiceService } from '../../finance/invoice/invoice.service';
import { ServiceVisitService } from './service-visit.service';

describe('ServiceVisitService', () => {
  let service: ServiceVisitService;
  let prisma: {
    $transaction: jest.Mock;
    serviceRequest: { findFirst: jest.Mock; update: jest.Mock };
    serviceVisit: { create: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock; count: jest.Mock };
    maintenanceSchedule: { update: jest.Mock; findFirst?: jest.Mock };
  };
  let assetService: { changeStatus: jest.Mock };
  let invoiceService: { createServiceFeeInvoice: jest.Mock };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
      serviceRequest: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
      serviceVisit: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      maintenanceSchedule: { update: jest.fn() },
    };
    assetService = { changeStatus: jest.fn().mockResolvedValue(undefined) };
    invoiceService = { createServiceFeeInvoice: jest.fn().mockResolvedValue({ id: 'inv-1' }) };

    const module = await Test.createTestingModule({
      providers: [
        ServiceVisitService,
        { provide: PrismaService, useValue: prisma },
        { provide: AssetService, useValue: assetService },
        { provide: InvoiceService, useValue: invoiceService },
      ],
    }).compile();
    service = module.get(ServiceVisitService);
  });

  describe('create', () => {
    it('throws NotFoundException when service request not found', async () => {
      prisma.serviceRequest.findFirst.mockResolvedValue(null);
      await expect(service.create('org-1', 'sr-x', {})).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when service request is COMPLETED', async () => {
      prisma.serviceRequest.findFirst.mockResolvedValue({
        id: 'sr-1',
        deletedAt: null,
        status: ServiceRequestStatus.COMPLETED,
      });
      await expect(service.create('org-1', 'sr-1', {})).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when service request is CANCELED', async () => {
      prisma.serviceRequest.findFirst.mockResolvedValue({
        id: 'sr-1',
        deletedAt: null,
        status: ServiceRequestStatus.CANCELED,
      });
      await expect(service.create('org-1', 'sr-1', {})).rejects.toThrow(BadRequestException);
    });

    it('creates service visit with SCHEDULED status', async () => {
      prisma.serviceRequest.findFirst.mockResolvedValue({
        id: 'sr-1',
        deletedAt: null,
        status: ServiceRequestStatus.RECEIVED,
      });
      prisma.serviceVisit.create.mockResolvedValue({ id: 'sv-1' });

      const result = await service.create('org-1', 'sr-1', {});

      expect(prisma.serviceVisit.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-1',
            serviceRequestId: 'sr-1',
            status: ServiceVisitStatus.SCHEDULED,
          }),
        }),
      );
      expect(result).toEqual({ id: 'sv-1' });
    });

    it('RECEIVED 접수는 방문 생성 시 SCHEDULED로 전이된다', async () => {
      prisma.serviceRequest.findFirst.mockResolvedValue({
        id: 'sr-1',
        deletedAt: null,
        status: ServiceRequestStatus.RECEIVED,
      });
      prisma.serviceVisit.create.mockResolvedValue({ id: 'sv-1' });

      await service.create('org-1', 'sr-1', {});

      expect(prisma.serviceRequest.update).toHaveBeenCalledWith({
        where: { id_organizationId: { id: 'sr-1', organizationId: 'org-1' } },
        data: { status: ServiceRequestStatus.SCHEDULED },
      });
    });

    it('RECEIVED 외 상태 접수는 방문 생성 시 상태를 변경하지 않는다', async () => {
      prisma.serviceRequest.findFirst.mockResolvedValue({
        id: 'sr-1',
        deletedAt: null,
        status: ServiceRequestStatus.IN_PROGRESS,
      });
      prisma.serviceVisit.create.mockResolvedValue({ id: 'sv-1' });

      await service.create('org-1', 'sr-1', {});

      expect(prisma.serviceRequest.update).not.toHaveBeenCalled();
    });
  });

  describe('complete', () => {
    const mockVisit = (overrides = {}) => ({
      id: 'sv-1',
      organizationId: 'org-1',
      status: ServiceVisitStatus.SCHEDULED,
      serviceRequestId: 'sr-1',
      ...overrides,
    });

    const mockRequest = (overrides = {}) => ({
      id: 'sr-1',
      assetId: 'asset-1',
      isWarranty: false,
      maintenanceScheduleId: null,
      status: ServiceRequestStatus.IN_PROGRESS,
      ...overrides,
    });

    it('throws NotFoundException when visit not found', async () => {
      prisma.serviceVisit.findFirst.mockResolvedValue(null);
      await expect(
        service.complete('org-1', 'sv-x', { result: ServiceVisitResult.REPAIRED }, 'member-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when visit is already COMPLETED', async () => {
      prisma.serviceVisit.findFirst.mockResolvedValue(mockVisit({ status: ServiceVisitStatus.COMPLETED }));
      await expect(
        service.complete('org-1', 'sv-1', { result: ServiceVisitResult.REPAIRED }, 'member-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when visit is CANCELED', async () => {
      prisma.serviceVisit.findFirst.mockResolvedValue(mockVisit({ status: ServiceVisitStatus.CANCELED }));
      await expect(
        service.complete('org-1', 'sv-1', { result: ServiceVisitResult.REPAIRED }, 'member-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('calls AssetService.changeStatus on completion', async () => {
      prisma.serviceVisit.findFirst.mockResolvedValue(mockVisit());
      prisma.serviceVisit.update.mockResolvedValue({});
      prisma.serviceRequest.findFirst.mockResolvedValue(mockRequest());

      await service.complete('org-1', 'sv-1', { result: ServiceVisitResult.REPAIRED }, 'member-1');

      expect(assetService.changeStatus).toHaveBeenCalledWith(
        'asset-1',
        'org-1',
        AssetStatus.AVAILABLE,
        AssetEventSourceType.SERVICE_VISIT,
        'sv-1',
      );
    });

    it('does NOT create invoice when isWarranty is true', async () => {
      prisma.serviceVisit.findFirst.mockResolvedValue(mockVisit());
      prisma.serviceVisit.update.mockResolvedValue({});
      prisma.serviceRequest.findFirst.mockResolvedValue(mockRequest({ isWarranty: true }));

      await service.complete('org-1', 'sv-1', { result: ServiceVisitResult.REPAIRED, laborCost: 50000 }, 'member-1');

      expect(invoiceService.createServiceFeeInvoice).not.toHaveBeenCalled();
    });

    it('does NOT create invoice when total cost is 0', async () => {
      prisma.serviceVisit.findFirst.mockResolvedValue(mockVisit());
      prisma.serviceVisit.update.mockResolvedValue({});
      prisma.serviceRequest.findFirst.mockResolvedValue(mockRequest());

      await service.complete('org-1', 'sv-1', { result: ServiceVisitResult.REPAIRED }, 'member-1');

      expect(invoiceService.createServiceFeeInvoice).not.toHaveBeenCalled();
    });

    it('creates SERVICE_FEE invoice when costs > 0 and not warranty', async () => {
      prisma.serviceVisit.findFirst.mockResolvedValue(mockVisit());
      prisma.serviceVisit.update.mockResolvedValue({});
      prisma.serviceRequest.findFirst.mockResolvedValue(mockRequest());

      await service.complete(
        'org-1',
        'sv-1',
        { result: ServiceVisitResult.REPAIRED, laborCost: 50000, partsCost: 30000, travelCost: 20000 },
        'member-1',
      );

      expect(invoiceService.createServiceFeeInvoice).toHaveBeenCalledWith(
        'org-1',
        'sr-1',
        { laborCost: 50000, partsCost: 30000, travelCost: 20000 },
        'member-1',
        prisma,
      );
    });

    it('방문 완료 후 잔여 방문 없고 후속 불필요 시 ServiceRequest를 COMPLETED로 전이한다', async () => {
      prisma.serviceVisit.findFirst.mockResolvedValue(mockVisit());
      prisma.serviceVisit.update.mockResolvedValue({});
      prisma.serviceRequest.findFirst.mockResolvedValue(mockRequest());
      prisma.serviceVisit.count.mockResolvedValue(0);

      await service.complete('org-1', 'sv-1', { result: ServiceVisitResult.REPAIRED }, 'member-1');

      expect(prisma.serviceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id_organizationId: { id: 'sr-1', organizationId: 'org-1' } },
          data: expect.objectContaining({ status: ServiceRequestStatus.COMPLETED }),
        }),
      );
    });

    it('requiresFollowUp=true이면 ServiceRequest를 자동 완료하지 않는다', async () => {
      prisma.serviceVisit.findFirst.mockResolvedValue(mockVisit());
      prisma.serviceVisit.update.mockResolvedValue({});
      prisma.serviceRequest.findFirst.mockResolvedValue(mockRequest());
      prisma.serviceVisit.count.mockResolvedValue(0);

      await service.complete(
        'org-1',
        'sv-1',
        { result: ServiceVisitResult.REPAIRED, requiresFollowUp: true },
        'member-1',
      );

      expect(prisma.serviceRequest.update).not.toHaveBeenCalled();
    });

    it('잔여 방문이 남아 있으면 ServiceRequest를 자동 완료하지 않는다', async () => {
      prisma.serviceVisit.findFirst.mockResolvedValue(mockVisit());
      prisma.serviceVisit.update.mockResolvedValue({});
      prisma.serviceRequest.findFirst.mockResolvedValue(mockRequest());
      prisma.serviceVisit.count.mockResolvedValue(1);

      await service.complete('org-1', 'sv-1', { result: ServiceVisitResult.REPAIRED }, 'member-1');

      expect(prisma.serviceRequest.update).not.toHaveBeenCalled();
    });

    it('ServiceRequest가 CANCELED이면 방문 완료 후 자동 완료 전이를 하지 않는다', async () => {
      prisma.serviceVisit.findFirst.mockResolvedValue(mockVisit());
      prisma.serviceVisit.update.mockResolvedValue({});
      prisma.serviceRequest.findFirst.mockResolvedValue(mockRequest({ status: ServiceRequestStatus.CANCELED }));
      prisma.serviceVisit.count.mockResolvedValue(0);

      await service.complete('org-1', 'sv-1', { result: ServiceVisitResult.REPAIRED }, 'member-1');

      expect(prisma.serviceRequest.update).not.toHaveBeenCalled();
    });

    it('updates MaintenanceSchedule nextScheduledAt when linked (MONTH interval)', async () => {
      prisma.serviceVisit.findFirst.mockResolvedValue(mockVisit());
      prisma.serviceVisit.update.mockResolvedValue({});
      prisma.serviceRequest.findFirst.mockResolvedValue(mockRequest({ maintenanceScheduleId: 'ms-1' }));
      prisma.maintenanceSchedule.update = jest.fn().mockResolvedValue({});

      const maintenanceSchedule = {
        id: 'ms-1',
        intervalUnit: 'MONTH',
        intervalValue: 3,
      };
      prisma.maintenanceSchedule = {
        ...prisma.maintenanceSchedule,
        findFirst: jest.fn().mockResolvedValue(maintenanceSchedule),
        update: jest.fn().mockResolvedValue({}),
      };

      await service.complete('org-1', 'sv-1', { result: ServiceVisitResult.REPAIRED }, 'member-1');

      expect(prisma.maintenanceSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lastInspectedAt: expect.any(Date),
            nextScheduledAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('cancel', () => {
    it('throws NotFoundException when visit not found', async () => {
      prisma.serviceVisit.findFirst.mockResolvedValue(null);
      await expect(service.cancel('org-1', 'sv-x')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when visit is already COMPLETED', async () => {
      prisma.serviceVisit.findFirst.mockResolvedValue({
        id: 'sv-1',
        status: ServiceVisitStatus.COMPLETED,
      });
      await expect(service.cancel('org-1', 'sv-1')).rejects.toThrow(BadRequestException);
    });

    it('sets status to CANCELED', async () => {
      prisma.serviceVisit.findFirst.mockResolvedValue({
        id: 'sv-1',
        status: ServiceVisitStatus.SCHEDULED,
        serviceRequestId: 'sr-1',
      });
      prisma.serviceVisit.update.mockResolvedValue({});

      await service.cancel('org-1', 'sv-1');

      expect(prisma.serviceVisit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ServiceVisitStatus.CANCELED }),
        }),
      );
    });

    it('잔여 활성 방문 없고 접수가 SCHEDULED이면 RECEIVED로 역전이한다', async () => {
      prisma.serviceVisit.findFirst.mockResolvedValue({
        id: 'sv-1',
        status: ServiceVisitStatus.SCHEDULED,
        serviceRequestId: 'sr-1',
      });
      prisma.serviceVisit.count.mockResolvedValue(0);
      prisma.serviceRequest.findFirst.mockResolvedValue({ status: ServiceRequestStatus.SCHEDULED });

      await service.cancel('org-1', 'sv-1');

      expect(prisma.serviceRequest.update).toHaveBeenCalledWith({
        where: { id_organizationId: { id: 'sr-1', organizationId: 'org-1' } },
        data: { status: ServiceRequestStatus.RECEIVED },
      });
    });

    it('잔여 활성 방문이 남아 있으면 접수 상태를 변경하지 않는다', async () => {
      prisma.serviceVisit.findFirst.mockResolvedValue({
        id: 'sv-1',
        status: ServiceVisitStatus.SCHEDULED,
        serviceRequestId: 'sr-1',
      });
      prisma.serviceVisit.count.mockResolvedValue(1);

      await service.cancel('org-1', 'sv-1');

      expect(prisma.serviceRequest.update).not.toHaveBeenCalled();
    });
  });
});
