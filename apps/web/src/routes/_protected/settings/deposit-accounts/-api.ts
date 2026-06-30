import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DepositAccount } from './-types';
import type { DepositAccountValues } from './-schemas';

export const depositAccountKeys = {
  all: ['deposit-accounts'] as const,
  list: (includeInactive: boolean) => [...depositAccountKeys.all, 'list', includeInactive] as const,
};

export const fetchDepositAccounts = (includeInactive = false) =>
  api.get<DepositAccount[]>('/deposit-accounts', { params: { includeInactive } }).then((r) => r.data);

export const createDepositAccount = (values: DepositAccountValues) =>
  api.post<DepositAccount>('/deposit-accounts', values).then((r) => r.data);

export const updateDepositAccount = (id: string, values: Partial<DepositAccountValues>) =>
  api.patch<DepositAccount>(`/deposit-accounts/${id}`, values).then((r) => r.data);

export const deleteDepositAccount = (id: string) => api.delete(`/deposit-accounts/${id}`).then((r) => r.data);

export function invalidateDepositAccounts(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: depositAccountKeys.all });
}
