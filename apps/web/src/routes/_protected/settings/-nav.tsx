import { Link } from '@tanstack/react-router';

const TABS = [
  { to: '/settings/account', label: '계정 설정' },
  { to: '/settings/members', label: '직원 관리' },
  { to: '/settings/deposit-accounts', label: '입금계좌' },
] as const;

// 설정 영역 공용 상단 탭 네비게이션
export function SettingsNav() {
  return (
    <nav className="mb-6 flex gap-1 border-b">
      {TABS.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          className="border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground"
          activeProps={{ className: 'border-primary text-foreground' }}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
