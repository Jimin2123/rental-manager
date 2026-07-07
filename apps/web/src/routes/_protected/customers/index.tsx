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
import { CustomerTable } from './-components/CustomerTable';
import { PartnerTable } from './-components/PartnerTable';
import { DetailPanel } from './-components/DetailPanel';

const searchSchema = z.object({
  tab: z.enum(['all', 'business', 'individual', 'partners', 'overdue']).catch('all'),
  q: z.string().catch(''),
});

export const Route = createFileRoute('/_protected/customers/')({
  validateSearch: searchSchema,
  component: CustomersPartnersPage,
});

type SelectedItem = { type: 'customer'; id: string } | { type: 'partner'; id: string } | null;

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

  // URL의 q가 외부에서 바뀌면 (뒤로가기 등) 인풋 동기화
  useEffect(() => {
    if (!composingRef.current) setInputValue(q);
  }, [q]);

  const { data: customers = [], isLoading: loadingCustomers } = useQuery<CustomerListItem[]>({
    queryKey: customerKeys.list({}),
    queryFn: () => fetchCustomers({}),
  });

  const { data: partners = [], isLoading: loadingPartners } = useQuery<BusinessPartnerListItem[]>({
    queryKey: partnerKeys.list({}),
    queryFn: () => fetchPartners({}),
  });

  const filteredCustomers = useMemo(() => {
    let list = customers;
    if (tab === 'business') list = list.filter((c) => c.type === 'BUSINESS');
    else if (tab === 'individual') list = list.filter((c) => c.type === 'INDIVIDUAL');
    else if (tab === 'overdue') list = list.filter((c) => c.isActive);
    if (q) {
      const lower = q.toLowerCase();
      list = list.filter((c) => {
        const name = (c.individualProfile?.name ?? c.businessPartner?.businessProfile.name ?? '').toLowerCase();
        const phone = c.individualProfile?.phone ?? '';
        return name.includes(lower) || phone.includes(lower);
      });
    }
    return list;
  }, [customers, tab, q]);

  const filteredPartners = useMemo(() => {
    let list = partners.filter((p) => p.roles.some((r) => r.type === 'PURCHASE'));
    if (q) {
      const lower = q.toLowerCase();
      list = list.filter((p) => p.businessProfile.name.toLowerCase().includes(lower));
    }
    return list;
  }, [partners, q]);

  const tabs = useMemo(
    () => [
      { value: 'all' as const, label: '전체', count: customers.length },
      { value: 'business' as const, label: '사업자', count: customers.filter((c) => c.type === 'BUSINESS').length },
      { value: 'individual' as const, label: '개인', count: customers.filter((c) => c.type === 'INDIVIDUAL').length },
      { value: 'partners' as const, label: '매입처', count: partners.filter((p) => p.roles.some((r) => r.type === 'PURCHASE')).length },
      { value: 'overdue' as const, label: '미수 있음', count: customers.filter((c) => c.isActive).length },
    ],
    [customers, partners],
  );

  const isPartnerTab = tab === 'partners';
  const isLoading = isPartnerTab ? loadingPartners : loadingCustomers;

  const handleCustomerSelect = (id: string) => {
    if (window.innerWidth < 1024) {
      void navigate({ to: '/customers/$id', params: { id } });
      return;
    }
    setSelectedItem((prev) => (prev?.type === 'customer' && prev.id === id ? null : { type: 'customer', id }));
  };

  const handlePartnerSelect = (id: string) => {
    if (window.innerWidth < 1024) {
      void navigate({ to: '/business-partners/$id', params: { id } });
      return;
    }
    setSelectedItem((prev) => (prev?.type === 'partner' && prev.id === id ? null : { type: 'partner', id }));
  };

  return (
    <div className="-m-6 p-6 min-h-full bg-[#f6f7f9] dark:bg-background flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-[21px] font-extrabold text-[#1c2230] dark:text-foreground tracking-tight">고객 · 거래처</h1>
        <Button onClick={() => void navigate({ to: isPartnerTab ? '/business-partners/new' : '/customers/new' })}>
          {isPartnerTab ? '+ 거래처 등록' : '+ 고객 등록'}
        </Button>
      </div>

      <FilterTabs tabs={tabs} activeTab={tab} onTabChange={setTab} />

      <Input
        placeholder={isPartnerTab ? '상호명 검색' : '이름 · 연락처 검색'}
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
          {isPartnerTab ? (
            <PartnerTable
              items={filteredPartners}
              isLoading={isLoading}
              selectedId={selectedItem?.type === 'partner' ? selectedItem.id : null}
              onSelect={handlePartnerSelect}
            />
          ) : (
            <CustomerTable
              items={filteredCustomers}
              isLoading={isLoading}
              selectedId={selectedItem?.type === 'customer' ? selectedItem.id : null}
              onSelect={handleCustomerSelect}
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
