import { InvoiceSettlementStatus } from '@prisma/client';

export function computeSettlementStatus(
  paidAmount: number,
  finalAmount: number,
  refundedAmount: number,
): InvoiceSettlementStatus {
  const netPaid = paidAmount - refundedAmount;
  if (netPaid <= 0) return InvoiceSettlementStatus.UNPAID;
  if (netPaid < finalAmount) return InvoiceSettlementStatus.PARTIALLY_PAID;
  if (netPaid === finalAmount) return InvoiceSettlementStatus.PAID;
  return InvoiceSettlementStatus.OVERPAID;
}
