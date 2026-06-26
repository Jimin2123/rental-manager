import { useNavigate } from '@tanstack/react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { invalidateIdentities, mergeAccount } from '../-api';

export function AccountMergeBanner({ token }: { token: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mergeMutation = useMutation({
    mutationFn: () => mergeAccount(token),
    onSuccess: () => {
      invalidateIdentities(queryClient);
      // success=merged 검색 파라미터로 이동하면 페이지의 토스트 이펙트가 발동한다.
      void navigate({ to: '/settings/account', search: { success: 'merged' } });
    },
    onError: () => toast.error('계정 병합에 실패했습니다. 다시 시도해주세요.'),
  });

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h2 className="text-sm font-semibold text-amber-900">다른 계정에 연동된 소셜 계정</h2>
      <p className="mt-1 text-xs text-amber-800">
        이 소셜 계정은 다른 계정에 이미 연동되어 있습니다. 해당 계정의 조직 데이터를 현재 계정으로 병합하시겠습니까?
        병합 시 기존 소셜 계정의 조직 멤버십이 현재 계정으로 이전되며, 이 작업은 되돌릴 수 없습니다.
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          variant="destructive"
          onClick={() => mergeMutation.mutate()}
          disabled={mergeMutation.isPending}
        >
          {mergeMutation.isPending ? '병합 중...' : '병합하기'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void navigate({ to: '/settings/account', search: {} })}
          disabled={mergeMutation.isPending}
        >
          취소
        </Button>
      </div>
    </div>
  );
}
