export type DepositAccount = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  label: string | null;
  isDefault: boolean;
  isActive: boolean;
  memo: string | null;
  createdAt: string;
};
