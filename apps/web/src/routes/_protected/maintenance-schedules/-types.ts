import type { CustomerRef } from '@/lib/customer';
import { customerNameOf } from '@/lib/customer';

export type { CustomerRef };
export { customerNameOf };

export type MaintenanceIntervalUnit = 'MONTH' | 'DAY';

export const INTERVAL_UNIT_LABEL: Record<MaintenanceIntervalUnit, string> = {
  MONTH: '개월',
  DAY: '일',
};

export const intervalLabel = (unit: MaintenanceIntervalUnit, value: number): string =>
  `${value}${INTERVAL_UNIT_LABEL[unit]}마다`;

export type ScheduleContract = {
  id: string;
  contractNo: string;
  rentalOrder: { order: { customer: CustomerRef } };
};

export const contractCustomerName = (c: ScheduleContract): string => customerNameOf(c.rentalOrder.order.customer);

export type MaintenanceScheduleListItem = {
  id: string;
  intervalUnit: MaintenanceIntervalUnit;
  intervalValue: number;
  nextScheduledAt: string;
  lastInspectedAt: string | null;
  isActive: boolean;
  memo: string | null;
  assignedStaffId: string | null;
  rentalContract: ScheduleContract;
  assignedStaff: { id: string; name: string } | null;
};

export type MaintenanceScheduleDetail = MaintenanceScheduleListItem;
