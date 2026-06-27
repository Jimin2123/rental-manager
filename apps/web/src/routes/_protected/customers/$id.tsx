import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { CustomerDetail } from './-types';
import { customerKeys, fetchCustomer, invalidateCustomer } from './-api';
import { CustomerDetailView } from './-components/CustomerDetailView';
import { CustomerEditForm } from './-components/CustomerEditForm';
import { AssignmentSection } from './-components/AssignmentSection';

export const Route = createFileRoute('/_protected/customers/$id')({
  component: CustomerDetailPage,
});

function CustomerDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: customer, isLoading } = useQuery<CustomerDetail>({
    queryKey: customerKeys.detail(id),
    queryFn: () => fetchCustomer(id),
  });

  const invalidate = () => invalidateCustomer(queryClient, id);

  if (isLoading) return <div className="p-6 text-muted-foreground">불러오는 중...</div>;
  if (!customer) return <div className="p-6 text-muted-foreground">고객을 찾을 수 없습니다.</div>;

  const title = customer.individualProfile?.name ?? customer.businessPartner?.businessProfile.name ?? '고객';

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/customers' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      </div>

      {isEditing ? (
        <CustomerEditForm
          customer={customer}
          onCancel={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false);
            invalidate();
          }}
        />
      ) : (
        <CustomerDetailView
          customer={customer}
          onEdit={() => setIsEditing(true)}
          onChanged={invalidate}
          onDeleted={() => {
            invalidate();
            void navigate({ to: '/customers' });
          }}
        />
      )}

      {/* 담당자 배정 — 개인 고객만 (법인은 거래처에서 관리) */}
      {customer.type === 'INDIVIDUAL' && <AssignmentSection customerId={customer.id} />}
    </div>
  );
}
