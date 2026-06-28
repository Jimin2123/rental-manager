import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { ContractDetail } from './-types';
import { contractKeys, fetchContract } from './-api';
import { ContractDetailView } from './-components/ContractDetailView';

export const Route = createFileRoute('/_protected/contracts/$id')({
  component: ContractDetailPage,
});

function ContractDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery<ContractDetail>({
    queryKey: contractKeys.detail(id),
    queryFn: () => fetchContract(id),
  });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/contracts' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">계약 상세</h1>
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">불러오는 중...</p>
      ) : isError || !data ? (
        <p className="text-muted-foreground">계약을 찾을 수 없습니다.</p>
      ) : (
        <ContractDetailView contract={data} />
      )}
    </div>
  );
}
