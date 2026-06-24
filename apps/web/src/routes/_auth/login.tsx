import { createFileRoute, redirect } from '@tanstack/react-router';
import { useAuthStore } from '@/store/auth.store';

export const Route = createFileRoute('/_auth/login')({
  beforeLoad: () => {
    const { currentOrganization } = useAuthStore.getState();
    if (currentOrganization) throw redirect({ to: '/' });
  },
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">로그인</h2>
      <p className="text-sm text-muted-foreground">로그인 폼은 Task 4에서 구현됩니다.</p>
    </div>
  );
}
