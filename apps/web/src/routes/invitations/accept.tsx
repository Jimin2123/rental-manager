import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type AxiosError } from 'axios';
import { useState } from 'react';
import { toast } from 'sonner';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/auth.store';
import type { Organization } from '@/store/auth.store';
import { storePendingInvite } from '@/lib/pending-invite';
import { fetchInvitationByToken, acceptByToken, declineByToken, signupAccept, fetchMe } from './-api';
import type { InvitationTokenView } from './-types';
import { signupAcceptSchema, type SignupAcceptValues } from './-schemas';

export const Route = createFileRoute('/invitations/accept')({
  validateSearch: z.object({ token: z.string().optional() }),
  component: AcceptInvitationPage,
});

const SOCIAL_PROVIDERS = [
  { key: 'google', label: 'Google로 계속하기' },
  { key: 'kakao', label: 'Kakao로 계속하기' },
  { key: 'naver', label: 'Naver로 계속하기' },
] as const;

/* ── 에러 화면 ── */
function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
          <h1 className="mb-2 text-xl font-bold text-card-foreground">초대 링크 오류</h1>
          <p className="mb-6 text-sm text-muted-foreground">{message}</p>
          <div className="flex justify-center gap-4">
            <Link to="/" className="text-sm text-primary underline-offset-4 hover:underline">
              홈으로
            </Link>
            <Link
              to="/login"
              search={{ error: undefined }}
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              로그인
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── 이미 멤버: 현재 로그인된 계정 기준 안내 ── */
const ROLE_LABEL: Record<Organization['role'], string> = {
  OWNER: '사업자',
  ADMIN: '관리자',
  MANAGER: '담당자',
  STAFF: '직원',
};

function AlreadyMemberScreen({ org }: { org: Organization }) {
  const { data: me } = useQuery({ queryKey: ['auth-me'], queryFn: fetchMe, retry: false });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md px-4">
        <div className="rounded-lg border bg-card p-8 text-center shadow-sm">
          <h1 className="mb-2 text-xl font-bold text-card-foreground">이미 가입된 조직입니다</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            현재 계정은 이미 이 조직의 멤버이므로 초대를 수락할 필요가 없습니다.
          </p>
          <div className="mb-6 space-y-3 rounded-lg border bg-muted/30 p-4 text-left">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">현재 로그인된 계정</p>
              <p className="text-sm font-semibold text-foreground">{me?.email ?? '—'}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">현재 로그인된 조직</p>
              <p className="text-base font-semibold text-foreground">{org.name}</p>
              <p className="text-xs text-muted-foreground">역할: {ROLE_LABEL[org.role]}</p>
            </div>
          </div>
          <Button asChild className="w-full">
            <Link to="/">홈으로</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── 조직 정보 카드 (읽기 전용) ── */
function OrgCard({ org }: { org: InvitationTokenView['organization'] }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <p className="mb-1 text-xs font-medium text-muted-foreground">합류할 조직</p>
      <p className="text-base font-semibold text-foreground">{org.businessProfile.name}</p>
      <p className="text-xs text-muted-foreground">사업자등록번호: {org.businessProfile.businessRegistrationNo}</p>
    </div>
  );
}

/* ── 로그인된 사용자: 수락/거절 ── */
function LoggedInActions({ token }: { token: string }) {
  const navigate = useNavigate();

  const acceptMutation = useMutation({
    mutationFn: () => acceptByToken(token),
    onSuccess: async () => {
      await navigate({ to: '/' });
    },
    onError: (err) => {
      const status = (err as AxiosError).response?.status;
      const msg = (err as AxiosError<{ message?: string }>).response?.data?.message;
      if (status === 409) {
        toast.error(msg ?? '이미 조직의 멤버입니다.');
        void navigate({ to: '/' });
      } else {
        toast.error(msg ?? '수락 중 오류가 발생했습니다.');
      }
    },
  });

  const declineMutation = useMutation({
    mutationFn: () => declineByToken(token),
    onSuccess: async () => {
      toast.success('초대를 거절했습니다.');
      await navigate({ to: '/' });
    },
    onError: (err) => {
      const msg = (err as AxiosError<{ message?: string }>).response?.data?.message;
      toast.error(msg ?? '거절 중 오류가 발생했습니다.');
    },
  });

  const isPending = acceptMutation.isPending || declineMutation.isPending;

  return (
    <div className="flex gap-3 pt-2">
      <Button className="flex-1" onClick={() => acceptMutation.mutate()} disabled={isPending}>
        {acceptMutation.isPending ? '처리 중...' : '수락'}
      </Button>
      <Button variant="outline" className="flex-1" onClick={() => declineMutation.mutate()} disabled={isPending}>
        {declineMutation.isPending ? '처리 중...' : '거절'}
      </Button>
    </div>
  );
}

/* ── 미로그인: 이메일 가입 폼 ── */
function SignupForm({ token, inviteEmail }: { token: string; inviteEmail: string }) {
  const form = useForm<SignupAcceptValues>({
    resolver: zodResolver(signupAcceptSchema),
    defaultValues: { email: inviteEmail, password: '', memberName: '' },
  });

  const onSubmit = async (values: SignupAcceptValues) => {
    try {
      await signupAccept(token, values);
      window.location.assign('/');
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      const msg = (err as AxiosError<{ message?: string }>).response?.data?.message;
      if (status === 409) {
        toast.error(msg ?? '이미 가입된 이메일입니다. 로그인 후 초대를 수락해주세요.');
      } else {
        toast.error(msg ?? '가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                이메일 <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input type="email" placeholder="name@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="memberName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                이름 <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="홍길동" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                비밀번호 <span className="text-destructive">*</span>
              </FormLabel>
              <FormControl>
                <Input type="password" placeholder="8자 이상" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? '가입 중...' : '가입하고 합류하기'}
        </Button>
      </form>
    </Form>
  );
}

/* ── 미로그인: 소셜 버튼 ── */
function SocialButtons({ token }: { token: string }) {
  const handleSocial = (provider: string) => {
    storePendingInvite(token);
    window.location.assign(`/auth/social/${provider}/redirect`);
  };

  return (
    <div className="space-y-2">
      {SOCIAL_PROVIDERS.map(({ key, label }) => (
        <Button key={key} variant="outline" className="w-full" onClick={() => handleSocial(key)}>
          {label}
        </Button>
      ))}
    </div>
  );
}

/* ── 미로그인: 탭 토글 ── */
type GuestTab = 'signup' | 'social';

function GuestActions({ token, inviteEmail }: { token: string; inviteEmail: string }) {
  const [tab, setTab] = useState<GuestTab>('signup');

  return (
    <div className="space-y-4">
      <div className="flex rounded-md border p-1">
        <button
          type="button"
          className={`flex-1 rounded py-1 text-sm font-medium transition-colors ${
            tab === 'signup' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('signup')}
        >
          이메일로 가입
        </button>
        <button
          type="button"
          className={`flex-1 rounded py-1 text-sm font-medium transition-colors ${
            tab === 'social' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setTab('social')}
        >
          소셜로 가입·로그인
        </button>
      </div>

      {tab === 'signup' ? <SignupForm token={token} inviteEmail={inviteEmail} /> : <SocialButtons token={token} />}

      <p className="text-center text-xs text-muted-foreground">
        이미 계정이 있으신가요?{' '}
        <Link to="/login" search={{ error: undefined }} className="text-primary underline-offset-4 hover:underline">
          로그인
        </Link>
      </p>
    </div>
  );
}

/* ── 메인 페이지 ── */
function AcceptInvitationPage() {
  const { token } = Route.useSearch();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const myOrganizations = useAuthStore((s) => s.organizations);

  const { data, isLoading, error } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => fetchInvitationByToken(token!),
    enabled: !!token,
    retry: false,
  });

  /* 토큰 없음 */
  if (!token) {
    return <ErrorScreen message="유효하지 않은 초대입니다." />;
  }

  /* 로딩 */
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">초대 정보를 불러오는 중...</p>
      </div>
    );
  }

  /* 에러 */
  if (error || !data) {
    const axiosErr = error as AxiosError<{ message?: string }> | null;
    const serverMsg = axiosErr?.response?.data?.message;
    const status = axiosErr?.response?.status;

    let displayMsg: string;
    if (serverMsg) {
      displayMsg = serverMsg;
    } else if (status === 410) {
      displayMsg = '만료된 초대입니다.';
    } else if (status === 409) {
      displayMsg = '이미 처리된 초대입니다.';
    } else {
      displayMsg = '유효하지 않은 초대입니다.';
    }

    return <ErrorScreen message={displayMsg} />;
  }

  // 로그인 상태에서 이미 이 초대 조직의 멤버라면(예: OWNER가 자기 조직 초대 클릭),
  // 초대 카드 대신 '현재 로그인된 계정' 기준 안내를 보여준다.
  // (초대된 이메일과 현재 로그인 계정은 다를 수 있으므로 초대 프레이밍을 쓰지 않는다.)
  const alreadyMemberOrg = isAuthenticated ? myOrganizations.find((o) => o.id === data.organization.id) : undefined;

  if (alreadyMemberOrg) {
    return <AlreadyMemberScreen org={alreadyMemberOrg} />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background py-12">
      <div className="w-full max-w-md px-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-foreground">렌탈 매니저</h1>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-1 text-lg font-semibold text-card-foreground">조직 초대</h2>
          <p className="mb-4 text-sm text-muted-foreground">아래 조직에 합류하도록 초대받았습니다.</p>

          <OrgCard org={data.organization} />

          <div className="my-2 rounded-md bg-muted/40 px-4 py-2 text-sm text-muted-foreground">
            초대된 이메일: <span className="font-medium text-foreground">{data.email}</span>
            {'  '}역할: <span className="font-medium text-foreground">{data.role}</span>
          </div>

          <Separator className="my-4" />

          {isAuthenticated ? (
            <LoggedInActions token={token} />
          ) : (
            <GuestActions token={token} inviteEmail={data.email} />
          )}
        </div>
      </div>
    </div>
  );
}
