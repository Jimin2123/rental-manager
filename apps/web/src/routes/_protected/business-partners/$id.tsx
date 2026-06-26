import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { BusinessPartnerDetail } from './-types';
import { partnerKeys, fetchPartner, invalidatePartner } from './-api';
import { PartnerDetailView } from './-components/PartnerDetailView';
import { PartnerEditForm } from './-components/PartnerEditForm';

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

  if (isLoading) return <div className="p-6 text-muted-foreground">불러오는 중...</div>;
  if (!partner) return <div className="p-6 text-muted-foreground">거래처를 찾을 수 없습니다.</div>;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/business-partners' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">{partner.businessProfile.name}</h1>
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
        <PartnerDetailView
          partner={partner}
          onEdit={() => setIsEditing(true)}
          onChanged={invalidate}
          onDeleted={() => {
            invalidate();
            void navigate({ to: '/business-partners' });
          }}
        />
      )}
    </div>
  );
}
