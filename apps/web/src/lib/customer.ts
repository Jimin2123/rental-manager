// 고객 표시명 유틸 — 개인=프로필명, 법인=상호명. (견적/주문/계약 공용)
export type CustomerRef = {
  id: string;
  individualProfile: { name: string } | null;
  businessPartner: { businessProfile: { name: string } } | null;
};

export function customerNameOf(c: CustomerRef): string {
  return c.individualProfile?.name ?? c.businessPartner?.businessProfile.name ?? '-';
}
