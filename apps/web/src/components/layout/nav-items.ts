import {
  Banknote,
  Building2,
  CalendarCheck,
  CreditCard,
  FileCheck,
  FileText,
  LayoutDashboard,
  Package,
  Receipt,
  RotateCcw,
  ScrollText,
  Settings,
  ShoppingCart,
  Users,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/', label: '대시보드', icon: LayoutDashboard },
  { to: '/quotations', label: '견적', icon: FileText },
  { to: '/orders', label: '거래', icon: ShoppingCart },
  { to: '/contracts', label: '계약', icon: FileCheck },
  { to: '/invoices', label: '청구서', icon: Receipt },
  { to: '/payments', label: '수납', icon: CreditCard },
  { to: '/refunds', label: '환불', icon: RotateCcw },
  { to: '/tax-invoices', label: '세금계산서', icon: Banknote },
  { to: '/service-requests', label: 'AS', icon: Wrench },
  { to: '/maintenance-schedules', label: '점검', icon: CalendarCheck },
  { to: '/products', label: '제품', icon: Package },
  { to: '/business-partners', label: '거래처', icon: Building2 },
  { to: '/customers', label: '고객', icon: Users },
  { to: '/audit-logs', label: '감사로그', icon: ScrollText },
] as const;

export const SETTINGS_ITEM: NavItem = {
  to: '/settings/account',
  label: '계정 설정',
  icon: Settings,
};
