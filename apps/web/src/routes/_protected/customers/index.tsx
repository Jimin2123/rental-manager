import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { customerKeys, fetchCustomers } from './-api';
import { partnerKeys, fetchPartners } from '../business-partners/-api';
import type { CustomerListItem } from './-types';
import type { BusinessPartnerListItem } from '../business-partners/-types';
import { FilterTabs } from './-components/FilterTabs';
import type { TabValue } from './-components/FilterTabs';
import { CombinedTable } from './-components/CombinedTable';
import { CustomerTable } from './-components/CustomerTable';
import { PartnerTable } from './-components/PartnerTable';
import { DetailPanel } from './-components/DetailPanel';

const searchSchema = z.object({
  tab: z.enum(['all', 'business', 'individual', 'partners']).catch('all'),
  q: z.string().catch(''),
});

export const Route = createFileRoute('/_protected/customers/')({
  validateSearch: searchSchema,
  component: CustomersPartnersPage,
});

export type SelectedItem = { type: 'individual'; id: string } | { type: 'partner'; id: string } | null;

function CustomersPartnersPage() {
  const navigate = useNavigate();
  const { tab, q } = Route.useSearch();
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);

  const setTab = (newTab: TabValue) => {
    void navigate({ to: '/customers', search: { tab: newTab, q } });
    setSelectedItem(null);
  };

  const setQ = (newQ: string) => {
    void navigate({ to: '/customers', search: { tab, q: newQ } });
  };

  const [inputValue, setInputValue] = useState(q);
  const composingRef = useRef(false);

  useEffect(() => {
    if (!composingRef.current) setInputValue(q);
  }, [q]);

  // 개인 고객만 가져온다 — 사업자(BUSINESS) 고객은 BusinessPartner로 표시
  const { data: individuals = [], isLoading: loadingIndividuals } = useQuery<CustomerListItem[]>({
    queryKey: customerKeys.list({ type: 'INDIVIDUAL' }),
    queryFn: () => fetchCustomers({ type: 'INDIVIDUAL' }),
  });

  // 역할 필터 없이 전체 거래처 — 겸업 거래처도 한 번만 포함
  const { data: partners = [], isLoading: loadingPartners } = useQuery<BusinessPartnerListItem[]>({
    queryKey: partnerKeys.list({}),
    queryFn: () => fetchPartners({}),
  });

  const filteredIndividuals = useMemo(() => {
    if (!q) return individuals;
    const lower = q.toLowerCase();
    return individuals.filter((c) => {
      const name = (c.individualProfile?.name ?? '').toLowerCase();
      const phone = c.individualProfile?.phone ?? '';
      return name.includes(lower) || phone.includes(lower);
    });
  }, [individuals, q]);

  const filteredPartners = useMemo(() => {
    let list = partners;
    if (tab === 'business') list = list.filter((p) => p.roles.some((r) => r.type === 'SALES'));
    else if (tab === 'partners') list = list.filter((p) => p.roles.some((r) => r.type === 'PURCHASE'));
    if (q) {
      const lower = q.toLowerCase();
      list = list.filter((p) => p.businessProfile.name.toLowerCase().includes(lower));
    }
    return list;
  }, [partners, tab, q]);

  const combinedItems = useMemo(() => {
    if (tab !== 'all') return [];
    return [
      ...filteredIndividuals.map((c) => ({ kind: 'individual' as const, data: c })),
      ...partners
        .filter((p) => !q || p.businessProfile.name.toLowerCase().includes(q.toLowerCase()))
        .map((p) => ({ kind: 'partner' as const, data: p })),
    ];
  }, [tab, filteredIndividuals, partners, q]);

  const salesPartnersCount = useMemo(() => partners.filter((p) => p.roles.some((r) => r.type === 'SALES')).length, [partners]);
  const purchasePartnersCount = useMemo(() => partners.filter((p) => p.roles.some((r) => r.type === 'PURCHASE')).length, [partners]);

  const tabs = useMemo(
    () => [
      { value: 'all' as const, label: '전체', count: individuals.length + partners.length },
      { value: 'individual' as const, label: '개인', count: individuals.length },
      { value: 'business' as const, label: '판매처', count: salesPartnersCount },
      { value: 'partners' as const, label: '매입처', count: purchasePartnersCount },
    ],
    [individuals, partners, salesPartnersCount, purchasePartnersCount],
  );

  const isIndividualTab = tab === 'individual';
  const isCombinedTab = tab === 'all';
  const isLoading = loadingIndividuals || loadingPartners;

  const isPartnerRoute = tab === 'partners' || tab === 'business';

  const handleIndividualSelect = (id: string) => {
    if (window.innerWidth < 1024) {
      void navigate({ to: '/customers/$id', params: { id } });
      return;
    }
    setSelectedItem((prev) => (prev?.type === 'individual' && prev.id === id ? null : { type: 'individual', id }));
  };

  const handlePartnerSelect = (id: string) => {
    if (window.innerWidth < 1024) {
      void navigate({ to: '/business-partners/$id', params: { id } });
      return;
    }
    setSelectedItem((prev) => (prev?.type === 'partner' && prev.id === id ? null : { type: 'partner', id }));
  };

  const combinedSelectedKey = selectedItem ? `${selectedItem.type}:${selectedItem.id}` : null;

  return (
    <div className="-m-6 p-6 min-h-full bg-[#f6f7f9] dark:bg-background flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[21px] font-extrabold text-[#1c2230] dark:text-foreground tracking-tight">고객 · 거래처</h1>
        <Button onClick={() => void navigate({ to: isIndividualTab ? '/customers/new' : '/business-partners/new' })}>
          {isIndividualTab ? '+ 고객 등록' : '+ 거래처 등록'}
        </Button>
      </div>

      <FilterTabs tabs={tabs} activeTab={tab} onTabChange={setTab} />

      <Input
        placeholder={isIndividualTab ? '이름 · 연락처 검색' : '상호명 검색'}
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          if (!composingRef.current) setQ(e.target.value);
        }}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={(e) => {
          composingRef.current = false;
          setQ(e.currentTarget.value);
        }}
        className="w-full sm:max-w-xs bg-white dark:bg-card"
      />

      <div className="flex gap-[14px] items-start">
        <div className="flex-1 min-w-0">
          {isCombinedTab ? (
            <CombinedTable
              items={combinedItems}
              isLoading={isLoading}
              selectedKey={combinedSelectedKey}
              onSelect={(kind, id) => kind === 'individual' ? handleIndividualSelect(id) : handlePartnerSelect(id)}
            />
          ) : isPartnerRoute ? (
            <PartnerTable
              items={filteredPartners}
              isLoading={isLoading}
              selectedId={selectedItem?.type === 'partner' ? selectedItem.id : null}
              onSelect={handlePartnerSelect}
            />
          ) : (
            <CustomerTable
              items={filteredIndividuals}
              isLoading={isLoading}
              selectedId={selectedItem?.type === 'individual' ? selectedItem.id : null}
              onSelect={handleIndividualSelect}
            />
          )}
        </div>
        {selectedItem && (
          <div className="hidden lg:block">
            <DetailPanel selected={selectedItem} />
          </div>
        )}
      </div>
    </div>
  );
}
