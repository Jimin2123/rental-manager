import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { won, date } from '@/lib/format';
import {
  QUOTATION_TYPE_LABEL,
  QUOTATION_STATUS_LABEL,
  type QuotationListItem,
} from '../../quotations/-types';
import {
  ORDER_TYPE_LABEL,
  ORDER_STATUS_LABEL,
  type OrderListItem,
} from '../../orders/-types';
import {
  CONTRACT_STATUS_LABEL,
  type ContractListItem,
} from '../../contracts/-types';
import {
  INVOICE_TYPE_LABEL,
  INVOICE_SETTLEMENT_LABEL,
  type InvoiceListItem,
} from '../../invoices/-types';
import {
  REQUEST_TYPE_LABEL,
  REQUEST_STATUS_LABEL,
  type ServiceRequestListItem,
} from '../../service-requests/-types';

type Tab = 'orders' | 'contracts' | 'billing' | 'service';
type BizTab = Tab | 'assets';

const TAB_LABELS: Record<BizTab, string> = {
  orders: '견적 / 주문',
  contracts: '렌탈계약',
  billing: '청구 / 미수금',
  service: 'AS 이력',
  assets: '공급 자산',
};

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="py-8 text-center text-sm text-muted-foreground">{message}</div>
  );
}

function QuotationsTab({ customerId }: { customerId: string }) {
  const { data: quotations = [], isLoading: qLoading } = useQuery({
    queryKey: ['customers', customerId, 'quotations'],
    queryFn: () =>
      api.get<QuotationListItem[]>('/quotations').then((r) =>
        r.data.filter((q) => q.customer.id === customerId),
      ),
  });

  const { data: orders = [], isLoading: oLoading } = useQuery({
    queryKey: ['customers', customerId, 'orders'],
    queryFn: () =>
      api.get<OrderListItem[]>('/orders').then((r) =>
        r.data.filter((o) => o.customer.id === customerId),
      ),
  });

  if (qLoading || oLoading)
    return <EmptyRow message="불러오는 중..." />;

  type Row = { id: string; no: string; typeLabel: string; statusLabel: string; managerName: string; dateStr: string; amount: string; href: string };
  const rows: Row[] = [
    ...quotations.map((q) => ({
      id: q.id,
      no: q.quotationNo,
      typeLabel: `견적(${QUOTATION_TYPE_LABEL[q.type]})`,
      statusLabel: QUOTATION_STATUS_LABEL[q.status],
      managerName: '-',
      dateStr: date(q.createdAt),
      amount: '-',
      href: `/quotations/${q.id}`,
    })),
    ...orders.map((o) => ({
      id: o.id,
      no: o.orderNo,
      typeLabel: ORDER_TYPE_LABEL[o.type],
      statusLabel: ORDER_STATUS_LABEL[o.status],
      managerName: o.manager?.name ?? '-',
      dateStr: date(o.orderDate),
      amount: '-',
      href: `/orders/${o.id}`,
    })),
  ].sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  if (rows.length === 0) return <EmptyRow message="견적·주문 내역이 없습니다." />;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1.3fr_.9fr_.9fr_1fr_.9fr] gap-3 px-1 text-xs font-semibold text-muted-foreground">
        <span>번호</span><span>유형</span><span>상태</span><span>담당자</span><span>일자</span>
      </div>
      {rows.map((r) => (
        <Link key={r.id} to={r.href} className="grid grid-cols-[1.3fr_.9fr_.9fr_1fr_.9fr] gap-3 items-center rounded-lg border px-3 h-9 text-sm hover:bg-muted/40 transition-colors">
          <span className="truncate font-medium">{r.no}</span>
          <span className="text-muted-foreground">{r.typeLabel}</span>
          <span className="text-muted-foreground">{r.statusLabel}</span>
          <span className="text-muted-foreground">{r.managerName}</span>
          <span className="text-muted-foreground">{r.dateStr}</span>
        </Link>
      ))}
    </div>
  );
}

function ContractsTab({ customerId }: { customerId: string }) {
  const { data: contracts = [], isLoading } = useQuery({
    queryKey: ['customers', customerId, 'contracts'],
    queryFn: () =>
      api.get<ContractListItem[]>('/rental-contracts').then((r) =>
        r.data.filter((c) => c.rentalOrder.order.customer.id === customerId),
      ),
  });

  if (isLoading) return <EmptyRow message="불러오는 중..." />;
  if (contracts.length === 0) return <EmptyRow message="렌탈계약 내역이 없습니다." />;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1.3fr_.8fr_1.3fr_1fr_.7fr] gap-3 px-1 text-xs font-semibold text-muted-foreground">
        <span>계약번호</span><span>상태</span><span>계약기간</span><span>월렌탈료</span><span>장비수</span>
      </div>
      {contracts.map((c) => {
        const monthlyTotal = c.items.reduce((s, i) => s + i.monthlyRentalPrice, 0);
        return (
          <Link
            key={c.id}
            to="/contracts/$id"
            params={{ id: c.id }}
            className="grid grid-cols-[1.3fr_.8fr_1.3fr_1fr_.7fr] gap-3 items-center rounded-lg border px-3 h-9 text-sm hover:bg-muted/40 transition-colors"
          >
            <span className="truncate font-medium">{c.contractNo}</span>
            <span className="text-muted-foreground">{CONTRACT_STATUS_LABEL[c.status]}</span>
            <span className="text-muted-foreground">{date(c.startDate)} ~ {date(c.endDate)}</span>
            <span className="text-muted-foreground">{won(monthlyTotal)}</span>
            <span className="text-muted-foreground">{c.items.length}대</span>
          </Link>
        );
      })}
    </div>
  );
}

function BillingTab({ customerId }: { customerId: string }) {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['customers', customerId, 'invoices'],
    queryFn: () =>
      api.get<InvoiceListItem[]>('/invoices', { params: { limit: 200 } }).then((r) =>
        r.data.filter((i) => i.customer.id === customerId),
      ),
  });

  if (isLoading) return <EmptyRow message="불러오는 중..." />;
  if (invoices.length === 0) return <EmptyRow message="청구·미수금 내역이 없습니다." />;

  const outstanding = invoices.reduce((s, i) => s + i.outstandingAmount, 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1.3fr_.9fr_.8fr_1fr_1fr] gap-3 px-1 text-xs font-semibold text-muted-foreground">
        <span>청구서번호</span><span>유형</span><span>청구월</span><span>청구금액</span><span>수납상태</span>
      </div>
      {invoices.map((i) => (
        <Link
          key={i.id}
          to="/invoices/$id"
          params={{ id: i.id }}
          className="grid grid-cols-[1.3fr_.9fr_.8fr_1fr_1fr] gap-3 items-center rounded-lg border px-3 h-9 text-sm hover:bg-muted/40 transition-colors"
        >
          <span className="truncate font-medium">{i.invoiceNo}</span>
          <span className="text-muted-foreground">{INVOICE_TYPE_LABEL[i.type]}</span>
          <span className="text-muted-foreground">{i.billingMonth ?? '-'}</span>
          <span className="text-muted-foreground">{won(i.finalAmount)}</span>
          <span className="text-muted-foreground">{INVOICE_SETTLEMENT_LABEL[i.settlementStatus]}</span>
        </Link>
      ))}
      {outstanding > 0 && (
        <div className="flex justify-end pt-1">
          <span className="text-sm text-destructive font-medium">미수금 합계 {won(outstanding)}</span>
        </div>
      )}
    </div>
  );
}

function ServiceTab({ customerId }: { customerId: string }) {
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['customers', customerId, 'service-requests'],
    queryFn: () =>
      api.get<ServiceRequestListItem[]>('/service-requests', { params: { limit: 200 } }).then((r) =>
        r.data.filter((sr) => sr.customer.id === customerId),
      ),
  });

  if (isLoading) return <EmptyRow message="불러오는 중..." />;
  if (requests.length === 0) return <EmptyRow message="AS 이력이 없습니다." />;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1.3fr_.9fr_.9fr_.9fr] gap-3 px-1 text-xs font-semibold text-muted-foreground">
        <span>접수번호</span><span>유형</span><span>상태</span><span>접수일</span>
      </div>
      {requests.map((sr) => (
        <Link
          key={sr.id}
          to="/service-requests/$id"
          params={{ id: sr.id }}
          className="grid grid-cols-[1.3fr_.9fr_.9fr_.9fr] gap-3 items-center rounded-lg border px-3 h-9 text-sm hover:bg-muted/40 transition-colors"
        >
          <span className="truncate font-medium">{sr.requestNo}</span>
          <span className="text-muted-foreground">{REQUEST_TYPE_LABEL[sr.type]}</span>
          <span className="text-muted-foreground">{REQUEST_STATUS_LABEL[sr.status]}</span>
          <span className="text-muted-foreground">{date(sr.createdAt)}</span>
        </Link>
      ))}
    </div>
  );
}

type Props = {
  customerId: string;
  isBusiness: boolean;
};

export function TransactionHistoryCard({ customerId, isBusiness }: Props) {
  const tabs: BizTab[] = ['orders', 'contracts', 'billing', 'service', ...(isBusiness ? (['assets'] as const) : [])];
  const [activeTab, setActiveTab] = useState<BizTab>('orders');

  return (
    <div className="rounded-xl border bg-card p-6 flex flex-col gap-5">
      <div className="flex items-center gap-2 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer',
              activeTab === tab
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            ].join(' ')}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'orders' && <QuotationsTab customerId={customerId} />}
        {activeTab === 'contracts' && <ContractsTab customerId={customerId} />}
        {activeTab === 'billing' && <BillingTab customerId={customerId} />}
        {activeTab === 'service' && <ServiceTab customerId={customerId} />}
        {activeTab === 'assets' && <EmptyRow message="공급 자산 기능은 준비 중입니다." />}
      </div>
    </div>
  );
}
