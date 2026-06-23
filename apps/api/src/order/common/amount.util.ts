import { VatType } from '@prisma/client';

export function calculateAmounts(quantity: number, unitPrice: number, vatType: VatType) {
  const supplyAmount = quantity * unitPrice;
  if (vatType === VatType.NONE) {
    return { supplyAmount, vatAmount: 0, totalAmount: supplyAmount };
  }
  // INCLUDED: unitPrice는 공급단가, 부가세 10% 추가
  const vatAmount = Math.round(supplyAmount * 0.1);
  const totalAmount = supplyAmount + vatAmount;
  return { supplyAmount, vatAmount, totalAmount };
}
