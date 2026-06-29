import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { ServiceRequestDetail } from './-types';
import { serviceRequestKeys, fetchServiceRequest } from './-api';
import { ServiceRequestDetailView } from './-components/ServiceRequestDetailView';

export const Route = createFileRoute('/_protected/service-requests/$id')({
  component: ServiceRequestDetailPage,
});

function ServiceRequestDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery<ServiceRequestDetail>({
    queryKey: serviceRequestKeys.detail(id),
    queryFn: () => fetchServiceRequest(id),
  });

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/service-requests' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">AS 접수 상세</h1>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">불러오는 중...</p>
      ) : isError || !data ? (
        <p className="text-muted-foreground">AS 접수를 찾을 수 없습니다.</p>
      ) : (
        <ServiceRequestDetailView request={data} />
      )}
    </div>
  );
}
