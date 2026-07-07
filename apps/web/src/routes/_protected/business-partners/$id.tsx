import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import type { BusinessPartnerDetail } from './-types';
import { partnerKeys, fetchPartner, invalidatePartner } from './-api';
import { PartnerProfileCard } from './-components/PartnerProfileCard';
import { PartnerEditForm } from './-components/PartnerEditForm';
import { SuppliedAssetsCard } from './-components/SuppliedAssetsCard';

export const Route = createFileRoute('/_protected/business-partners/$id')({
  component: BusinessPartnerDetailPage,
});

function BusinessPartnerDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: partner, isLoading } = useQuery<BusinessPartnerDetail>({
    queryKey: partnerKeys.detail(id),
    queryFn: () => fetchPartner(id),
  });

  const invalidate = () => invalidatePartner(queryClient, id);

  const toggleStatusMutation = useMutation({
    mutationFn: () =>
      api.patch(`/business-partners/${id}`, { isActive: !partner?.isActive }),
    onSuccess: () => {
      toast.success(partner?.isActive ? '거래가 정지되었습니다.' : '거래가 재개되었습니다.');
      invalidate();
    },
    onError: () => toast.error('상태 변경 중 오류가 발생했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/business-partners/${id}`),
    onSuccess: () => {
      toast.success('거래처가 삭제되었습니다.');
      invalidate();
      void navigate({ to: '/business-partners' });
    },
    onError: () => toast.error('삭제 중 오류가 발생했습니다.'),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">불러오는 중...</div>;
  if (!partner) return <div className="p-6 text-muted-foreground">거래처를 찾을 수 없습니다.</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/business-partners' })}>
          ← 목록
        </Button>
      </div>

      {isEditing ? (
        <PartnerEditForm
          partner={partner}
          onCancel={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false);
            invalidate();
          }}
          onContactChanged={invalidate}
        />
      ) : (
        <PartnerProfileCard
          partner={partner}
          onEdit={() => setIsEditing(true)}
          onToggleStatus={() => void toggleStatusMutation.mutate()}
          isTogglingStatus={toggleStatusMutation.isPending}
          onDelete={() => void deleteMutation.mutate()}
          isDeleting={deleteMutation.isPending}
        />
      )}

      <SuppliedAssetsCard partnerId={id} />
    </div>
  );
}
