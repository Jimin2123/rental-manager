import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { AccountMergeBanner } from './-components/AccountMergeBanner';
import { SocialIdentityCard } from './-components/SocialIdentityCard';

export const Route = createFileRoute('/_protected/settings/account')({
  validateSearch: z.object({
    success: z.string().optional(),
    error: z.string().optional(),
    merge_token: z.string().optional(),
  }),
  component: AccountSettingsPage,
});

function AccountSettingsPage() {
  const { success, error, merge_token } = Route.useSearch();

  useEffect(() => {
    if (success === 'linked') toast.success('소셜 계정이 연동되었습니다.');
    if (success === 'merged') toast.success('계정이 병합되었습니다.');
    if (error === 'link_conflict') toast.error('이 소셜 계정은 다른 계정에 이미 연동되어 있습니다.');
    else if (error === 'link') toast.error('소셜 계정 연동에 실패했습니다. 다시 시도해주세요.');
  }, [success, error]);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-xl font-semibold text-foreground">계정 설정</h1>
      {merge_token && <AccountMergeBanner token={merge_token} />}
      <SocialIdentityCard />
    </div>
  );
}
