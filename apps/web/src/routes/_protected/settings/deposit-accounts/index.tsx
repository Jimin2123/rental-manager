import { createFileRoute } from '@tanstack/react-router';
import { useAuthStore } from '@/store/auth.store';
import { SettingsNav } from '../-nav';
import { DepositAccountTable } from './-components/DepositAccountTable';

export const Route = createFileRoute('/_protected/settings/deposit-accounts/')({
  component: DepositAccountsPage,
});

function DepositAccountsPage() {
  const org = useAuthStore((s) => s.currentOrganization);
  const canManage = org?.role === 'OWNER' || org?.role === 'ADMIN';

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold text-foreground">설정</h1>
      <SettingsNav />
      {!org ? null : !canManage ? (
        <p className="text-sm text-muted-foreground">입금계좌 관리는 관리자만 접근할 수 있습니다.</p>
      ) : (
        <DepositAccountTable />
      )}
    </div>
  );
}
