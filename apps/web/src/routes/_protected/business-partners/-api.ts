import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BusinessPartnerListItem, BusinessPartnerDetail, RoleType } from './-types';

export type PartnerListFilters = { q?: string; role?: RoleType };

// ─── 쿼리 키 팩토리 ───────────────────────────────────────────────
// 거래처 목록 키는 products(매입처 드롭다운)에서도 partnerKeys.list({ role: 'PURCHASE' })로 재사용한다.
export const partnerKeys = {
  all: ['business-partners'] as const,
  lists: () => [...partnerKeys.all, 'list'] as const,
  list: (filters: PartnerListFilters = {}) => [...partnerKeys.all, 'list', filters] as const,
  detail: (id: string) => [...partnerKeys.all, 'detail', id] as const,
};

// ─── 조회 함수 ────────────────────────────────────────────────────
export const fetchPartners = (filters: PartnerListFilters) =>
  api
    .get<BusinessPartnerListItem[]>('/business-partners', {
      params: { ...(filters.q && { q: filters.q }), ...(filters.role && { role: filters.role }) },
    })
    .then((r) => r.data);

export const fetchPartner = (id: string) =>
  api.get<BusinessPartnerDetail>(`/business-partners/${id}`).then((r) => r.data);

// ─── 무효화 헬퍼 ──────────────────────────────────────────────────
// 거래처가 바뀌면 상세 + 모든 목록(역할 필터/매입처 드롭다운 포함)을 갱신한다.
export function invalidatePartner(qc: QueryClient, id: string): void {
  void qc.invalidateQueries({ queryKey: partnerKeys.detail(id) });
  void qc.invalidateQueries({ queryKey: partnerKeys.lists() });
}
