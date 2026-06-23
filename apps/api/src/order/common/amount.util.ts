import { VatType } from '@prisma/client';

export function calculateAmounts(quantity: number, unitPrice: number, vatType: VatType) {
  if (vatType === VatType.NONE) {
    const supplyAmount = quantity * unitPrice;
    return { supplyAmount, vatAmount: 0, totalAmount: supplyAmount };
  }
  const totalAmount = quantity * unitPrice;
  const supplyAmount = Math.round(totalAmount / 1.1);
  const vatAmount = totalAmount - supplyAmount;
  return { supplyAmount, vatAmount, totalAmount };
}
