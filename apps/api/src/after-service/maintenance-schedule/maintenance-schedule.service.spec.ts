import { NotFoundException } from '@nestjs/common';
import { MaintenanceIntervalUnit } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { MaintenanceScheduleService } from './maintenance-schedule.service';

describe('MaintenanceScheduleService', () => {
  let service: MaintenanceScheduleService;
  let prisma: {
    rentalContract: { findUnique: jest.Mock };
    organizationMember: { findUnique: jest.Mock };
    maintenanceSchedule: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      rentalContract: { findUnique: jest.fn() },
      organizationMember: { findUnique: jest.fn() },
      maintenanceSchedule: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [MaintenanceScheduleService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(MaintenanceScheduleService);
  });

  describe('create', () => {
    it('throws NotFoundException when rental contract not found', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue(null);
      await expect(
        service.create('org-1', {
          rentalContractId: 'rc-x',
          intervalUnit: MaintenanceIntervalUnit.MONTH,
          intervalValue: 3,
          nextScheduledAt: '2026-09-24',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates maintenance schedule with isActive: true', async () => {
      prisma.rentalContract.findUnique.mockResolvedValue({ id: 'rc-1' });
      prisma.maintenanceSchedule.create.mockResolvedValue({ id: 'ms-1' });

      const result = await service.create('org-1', {
        rentalContractId: 'rc-1',
        intervalUnit: MaintenanceIntervalUnit.MONTH,
        intervalValue: 3,
        nextScheduledAt: '2026-09-24',
      });

      expect(prisma.maintenanceSchedule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: true, intervalValue: 3 }),
        }),
      );
      expect(result).toEqual({ id: 'ms-1' });
    });
  });

  describe('deactivate', () => {
    it('throws NotFoundException when schedule not found', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue(null);
      await expect(service.deactivate('org-1', 'ms-x')).rejects.toThrow(NotFoundException);
    });

    it('sets isActive to false', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue({ id: 'ms-1', isActive: true });
      prisma.maintenanceSchedule.update.mockResolvedValue({});

      await service.deactivate('org-1', 'ms-1');

      expect(prisma.maintenanceSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
      );
    });

    it('no-ops when already inactive', async () => {
      prisma.maintenanceSchedule.findUnique.mockResolvedValue({ id: 'ms-1', isActive: false });

      await service.deactivate('org-1', 'ms-1');

      expect(prisma.maintenanceSchedule.update).not.toHaveBeenCalled();
    });
  });
});
