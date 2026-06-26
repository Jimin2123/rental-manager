import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type AxiosError } from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { LinkedIdentity, OAuthProvider } from '../-types';
import { PROVIDERS } from '../-types';
import { fetchIdentities, identityKeys, invalidateIdentities, socialLinkRedirectUrl, unlinkSocial } from '../-api';

export function SocialIdentityCard() {
  const queryClient = useQueryClient();

  const {
    data: linked = [],
    isLoading,
    isError,
  } = useQuery<LinkedIdentity[]>({
    queryKey: identityKeys.all,
    queryFn: fetchIdentities,
  });

  const unlinkMutation = useMutation({
    mutationFn: (provider: OAuthProvider) => unlinkSocial(provider),
    onSuccess: () => {
      invalidateIdentities(queryClient);
      toast.success('연동이 해제되었습니다.');
    },
    onError: (err) => {
      const status = (err as AxiosError).response?.status;
      if (status === 409) {
        toast.error('비밀번호를 설정하거나 다른 소셜 계정을 연동한 후 해제할 수 있습니다.');
      } else {
        toast.error('연동 해제 중 오류가 발생했습니다.');
      }
    },
  });

  const isProviderLinked = (provider: OAuthProvider) => linked.some((i) => i.provider === provider);
  const linkedEmail = (provider: OAuthProvider) => linked.find((i) => i.provider === provider)?.providerEmail;
  const handleLink = (provider: OAuthProvider) => window.location.assign(socialLinkRedirectUrl(provider));

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="p-4">
        <h2 className="text-sm font-semibold text-foreground">소셜 계정 연동</h2>
        <p className="mt-1 text-xs text-muted-foreground">연동하면 해당 소셜 계정으로 로그인할 수 있습니다.</p>
      </div>
      <Separator />
      {isLoading ? (
        <div className="p-4 text-sm text-muted-foreground">불러오는 중...</div>
      ) : isError ? (
        <div className="p-4 text-sm text-muted-foreground">연동 정보를 불러오지 못했습니다.</div>
      ) : (
        <ul className="divide-y">
          {PROVIDERS.map(({ key, label }) => (
            <li key={key} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                {isProviderLinked(key) && (
                  <p className="text-xs text-muted-foreground">{linkedEmail(key) ?? '이메일 없음'}</p>
                )}
              </div>
              {isProviderLinked(key) ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => unlinkMutation.mutate(key)}
                  disabled={unlinkMutation.isPending}
                >
                  해제
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => handleLink(key)}>
                  연동
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
