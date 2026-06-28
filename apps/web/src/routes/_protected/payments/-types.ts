import type { CustomerRef } from '@/lib/customer';

export type { CustomerRef };
export { customerNameOf } from '@/lib/customer';

export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'CANCELED' | 'FAILED';
export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'VIRTUAL_ACCOUNT' | 'CMS' | 'ETC';
export type PaymentProvider = 'MANUAL' | 'TOSS_PAYMENTS' | 'PORTONE' | 'INICIS' | 'KCP' | 'BANK_API' | 'OPEN_BANKING';

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: '대기',
  COMPLETED: '완료',
  CANCELED: '취소',
  FAILED: '실패',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: '현금',
  BANK_TRANSFER: '계좌이체',
  CARD: '카드',
  VIRTUAL_ACCOUNT: '가상계좌',
  CMS: 'CMS',
  ETC: '기타',
};

export const PAYMENT_PROVIDER_LABEL: Record<PaymentProvider, string> = {
  MANUAL: '수동 등록',
  TOSS_PAYMENTS: '토스페이먼츠',
  PORTONE: '포트원',
  INICIS: '이니시스',
  KCP: 'KCP',
  BANK_API: '은행 API',
  OPEN_BANKING: '오픈뱅킹',
};

export type PaymentListItem = {
  id: string;
  paymentNo: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amount: number;
  paidAt: string;
  customer: CustomerRef;
};

export type PaymentAllocation = {
  id: string;
  amount: number;
  invoice: { id: string; invoiceNo: string };
};

export type PaymentDetail = PaymentListItem & {
  provider: PaymentProvider;
  externalRef: string | null;
  memo: string | null;
  allocations: PaymentAllocation[];
};
