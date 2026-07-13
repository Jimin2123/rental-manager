import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { CustomerDetail } from './-types';
import { customerKeys, fetchCustomer, invalidateCustomer } from './-api';
import { CustomerProfileCard } from './-components/CustomerProfileCard';
import { CustomerEditForm } from './-components/CustomerEditForm';
import { AssignmentSection } from './-components/AssignmentSection';
import { TransactionHistoryCard } from './-components/TransactionHistoryCard';

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

  // BUSINESS 고객은 거래처 상세 페이지로 리다이렉트
  useEffect(() => {
    if (customer?.type === 'BUSINESS' && customer.businessPartner?.id) {
      void navigate({
        to: '/business-partners/$id',
        params: { id: customer.businessPartner.id },
        replace: true,
      });
    }
  }, [customer, navigate]);

  const toggleStatusMutation = useMutation({
    mutationFn: () => api.patch(`/customers/${id}`, { isActive: !customer?.isActive }),
    onSuccess: () => {
      toast.success(customer?.isActive ? '거래가 정지되었습니다.' : '거래가 재개되었습니다.');
      invalidateCustomer(queryClient, id);
    },
    onError: () => toast.error('상태 변경 중 오류가 발생했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/customers/${id}`),
    onSuccess: () => {
      toast.success('고객이 삭제되었습니다.');
      void navigate({ to: '/customers' });
    },
    onError: () => toast.error('삭제 중 오류가 발생했습니다.'),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">불러오는 중...</div>;
  if (!customer) return <div className="p-6 text-muted-foreground">고객을 찾을 수 없습니다.</div>;
  // BUSINESS 리다이렉트 중에는 아무것도 렌더하지 않음
  if (customer.type === 'BUSINESS') return null;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/customers' })}>
          ← 목록
        </Button>
      </div>

      {isEditing ? (
        <CustomerEditForm
          customer={customer}
          onCancel={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false);
            invalidateCustomer(queryClient, id);
          }}
        />
      ) : (
        <CustomerProfileCard
          customer={customer}
          onEdit={() => setIsEditing(true)}
          onToggleStatus={() => void toggleStatusMutation.mutate()}
          isTogglingStatus={toggleStatusMutation.isPending}
          onDelete={() => void deleteMutation.mutate()}
          isDeleting={deleteMutation.isPending}
        />
      )}

      {!isEditing && (
        <AssignmentSection customerId={customer.id} individualProfileId={customer.individualProfile?.id} />
      )}

      {!isEditing && <TransactionHistoryCard customerId={id} isBusiness={false} />}
    </div>
  );
}
