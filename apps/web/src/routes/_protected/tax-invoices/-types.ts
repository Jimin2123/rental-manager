import type { CustomerRef } from '@/lib/customer';

export type { CustomerRef };
export { customerNameOf } from '@/lib/customer';

export type TaxInvoiceType = 'TAX_INVOICE' | 'CREDIT_NOTE';
export type TaxInvoiceStatus = 'DRAFT' | 'ISSUED' | 'CANCELED' | 'NTS_CONFIRMED';

export const TAX_INVOICE_TYPE_LABEL: Record<TaxInvoiceType, string> = {
  TAX_INVOICE: '세금계산서',
  CREDIT_NOTE: '수정세금계산서',
};

export const TAX_INVOICE_STATUS_LABEL: Record<TaxInvoiceStatus, string> = {
  DRAFT: '작성중',
  ISSUED: '발행',
  CANCELED: '취소',
  NTS_CONFIRMED: '국세청승인',
};

export type TaxInvoiceListItem = {
  id: string;
  taxInvoiceNo: string;
  type: TaxInvoiceType;
  status: TaxInvoiceStatus;
  buyerName: string;
  issueDate: string;
  supplyAmount: number;
  vatAmount: number;
  totalAmount: number;
  customer: CustomerRef;
};

export type TaxInvoiceAmendment = {
  id: string;
  taxInvoiceNo: string;
  status: TaxInvoiceStatus;
};

export type TaxInvoiceDetail = TaxInvoiceListItem & {
  buyerBusinessNo: string;
  buyerCeoName: string | null;
  buyerEmail: string | null;
  originalTaxInvoiceId: string | null;
  invoice: { id: string; invoiceNo: string } | null;
  amendments: TaxInvoiceAmendment[];
};
