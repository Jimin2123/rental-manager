export type ContractFormState = {
  startDate: string;
  endDate: string;
  contractMonths: number;
  billingDay: string; // '' 허용
  paymentDueDay: string;
  billingTiming: 'PREPAID' | 'POSTPAID';
};

export type CreateContractBody = {
  rentalOrderId: string;
  startDate: string;
  endDate: string;
  contractMonths: number;
  billingDay?: number;
  paymentDueDay?: number;
  billingTiming?: 'PREPAID' | 'POSTPAID';
};

export function emptyContractForm(): ContractFormState {
  return {
    startDate: '',
    endDate: '',
    contractMonths: 12,
    billingDay: '',
    paymentDueDay: '',
    billingTiming: 'PREPAID',
  };
}

export function buildCreateContractBody(rentalOrderId: string, s: ContractFormState): CreateContractBody {
  return {
    rentalOrderId,
    startDate: new Date(s.startDate).toISOString(),
    endDate: new Date(s.endDate).toISOString(),
    contractMonths: s.contractMonths,
    ...(s.billingDay && { billingDay: Number(s.billingDay) }),
    ...(s.paymentDueDay && { paymentDueDay: Number(s.paymentDueDay) }),
    billingTiming: s.billingTiming,
  };
}

export function isContractSubmittable(s: ContractFormState): boolean {
  return s.startDate !== '' && s.endDate !== '' && s.contractMonths > 0;
}
