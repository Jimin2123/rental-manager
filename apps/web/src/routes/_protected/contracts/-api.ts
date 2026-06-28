import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ContractListItem, ContractDetail } from './-types';

export const contractKeys = {
  all: ['contracts'] as const,
  lists: () => [...contractKeys.all, 'list'] as const,
  list: () => [...contractKeys.all, 'list'] as const,
  detail: (id: string) => [...contractKeys.all, 'detail', id] as const,
};

// 백엔드 findAll은 필터 미지원 → 전체 조회 후 클라이언트에서 상태 필터.
export const fetchContracts = () => api.get<ContractListItem[]>('/rental-contracts').then((r) => r.data);

export const fetchContract = (id: string) => api.get<ContractDetail>(`/rental-contracts/${id}`).then((r) => r.data);

export function invalidateContract(qc: QueryClient, id: string): void {
  void qc.invalidateQueries({ queryKey: contractKeys.detail(id) });
  void qc.invalidateQueries({ queryKey: contractKeys.lists() });
}
