import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';

export const Route = createFileRoute('/_protected/settings/account')({
  validateSearch: z.object({ success: z.string().optional(), error: z.string().optional() }),
  component: AccountSettingsPage,
});

type OAuthProvider = 'GOOGLE' | 'KAKAO' | 'NAVER';
type LinkedIdentity = { provider: OAuthProvider; providerEmail: string | null };

const PROVIDERS: { key: OAuthProvider; label: string }[] = [
  { key: 'GOOGLE', label: 'Google' },
  { key: 'KAKAO', label: 'Kakao' },
  { key: 'NAVER', label: 'Naver' },
];

function AccountSettingsPage() {
  const { success, error } = Route.useSearch();
  const [linked, setLinked] = useState<LinkedIdentity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (success === 'linked') toast.success('소셜 계정이 연동되었습니다.');
    if (error === 'link_conflict') toast.error('이 소셜 계정은 다른 계정에 이미 연동되어 있습니다.');
    else if (error === 'link') toast.error('소셜 계정 연동에 실패했습니다. 다시 시도해주세요.');
  }, [success, error]);

  useEffect(() => {
    api
      .get<LinkedIdentity[]>('/auth/social/identities')
      .then(({ data }) => setLinked(data))
      .catch(() => toast.error('연동 정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  const isLinked = (provider: OAuthProvider) => linked.some((i) => i.provider === provider);
  const linkedEmail = (provider: OAuthProvider) => linked.find((i) => i.provider === provider)?.providerEmail;

  const handleLink = (provider: string) => {
    window.location.assign(`/auth/social/link/${provider.toLowerCase()}/redirect`);
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-xl font-semibold text-foreground">계정 설정</h1>

      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-4">
          <h2 className="text-sm font-semibold text-foreground">소셜 계정 연동</h2>
          <p className="mt-1 text-xs text-muted-foreground">연동하면 해당 소셜 계정으로 로그인할 수 있습니다.</p>
        </div>
        <Separator />
        {loading ? (
          <div className="p-4 text-sm text-muted-foreground">불러오는 중...</div>
        ) : (
          <ul className="divide-y">
            {PROVIDERS.map(({ key, label }) => (
              <li key={key} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  {isLinked(key) && (
                    <p className="text-xs text-muted-foreground">{linkedEmail(key) ?? '이메일 없음'}</p>
                  )}
                </div>
                {isLinked(key) ? (
                  <span className="text-xs font-medium text-green-600">연동됨</span>
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
    </div>
  );
}
