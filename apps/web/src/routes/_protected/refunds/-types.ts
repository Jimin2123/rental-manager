import type { CustomerRef } from '@/lib/customer';
import type { PaymentMethod } from '../payments/-types';

export type { CustomerRef };
export { customerNameOf } from '@/lib/customer';
export { PAYMENT_METHOD_LABEL } from '../payments/-types';
export type { PaymentMethod };

export type RefundStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
export type RefundReason =
  | 'SALE_CANCEL'
  | 'SALE_RETURN'
  | 'RENTAL_CANCEL'
  | 'RENTAL_PRORATION'
  | 'OVERPAYMENT'
  | 'BILLING_ERROR'
  | 'ETC';

export const REFUND_STATUS_LABEL: Record<RefundStatus, string> = {
  PENDING: '대기',
  COMPLETED: '완료',
  FAILED: '실패',
  CANCELED: '취소',
};

export const REFUND_REASON_LABEL: Record<RefundReason, string> = {
  SALE_CANCEL: '판매 취소',
  SALE_RETURN: '반품',
  RENTAL_CANCEL: '렌탈 취소',
  RENTAL_PRORATION: '중도해지 일할',
  OVERPAYMENT: '초과 입금',
  BILLING_ERROR: '청구 오류',
  ETC: '기타',
};

export type RefundListItem = {
  id: string;
  refundNo: string;
  status: RefundStatus;
  reason: RefundReason;
  amount: number;
  customer: CustomerRef;
};

export type RefundDetail = RefundListItem & {
  method: PaymentMethod | null;
  memo: string | null;
  refundedAt: string | null;
  payment: { id: string; paymentNo: string } | null;
  invoice: { id: string; invoiceNo: string } | null;
};
