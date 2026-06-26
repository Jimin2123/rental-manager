import { createFileRoute } from '@tanstack/react-router';
import { useAuthStore } from '@/store/auth.store';
import { SettingsNav } from '../-nav';
import { MemberTable } from './-components/MemberTable';
import { PendingInvitations } from './-components/PendingInvitations';

export const Route = createFileRoute('/_protected/settings/members/')({
  component: MembersPage,
});

function MembersPage() {
  const org = useAuthStore((s) => s.currentOrganization);
  const canManage = org?.role === 'OWNER' || org?.role === 'ADMIN';

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold text-foreground">설정</h1>
      <SettingsNav />
      {!org ? null : !canManage ? (
        <p className="text-sm text-muted-foreground">직원 관리는 관리자만 접근할 수 있습니다.</p>
      ) : (
        <div className="space-y-6">
          <MemberTable orgId={org.id} />
          <PendingInvitations orgId={org.id} />
        </div>
      )}
    </div>
  );
}
