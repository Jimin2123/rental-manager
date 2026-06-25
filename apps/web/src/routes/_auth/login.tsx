import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type AxiosError } from 'axios';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { Organization } from '@/store/auth.store';

export const Route = createFileRoute('/_auth/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search['error'] === 'string' ? search['error'] : undefined,
  }),
  beforeLoad: () => {
    const { isAuthenticated, currentOrganization } = useAuthStore.getState();
    if (isAuthenticated && currentOrganization) throw redirect({ to: '/' });
    if (isAuthenticated && !currentOrganization) throw redirect({ to: '/setup' });
  },
  component: LoginPage,
});

const loginSchema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
});

type LoginForm = z.infer<typeof loginSchema>;

const SOCIAL_PROVIDERS = [
  { key: 'google', label: 'Google로 로그인' },
  { key: 'kakao', label: 'Kakao로 로그인' },
  { key: 'naver', label: 'Naver로 로그인' },
] as const;

function LoginPage() {
  const navigate = useNavigate();
  const { error } = Route.useSearch();

  useEffect(() => {
    if (error === 'social') toast.error('소셜 로그인에 실패했습니다. 다시 시도해주세요.');
  }, [error]);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginForm) => {
    try {
      const { data } = await api.post<Organization[]>('/auth/login', values);
      if (data[0]) {
        await api.post('/auth/switch-org', { organizationId: data[0].id });
      }
      useAuthStore.getState().setAuth(data);
      await navigate({ to: '/' });
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      if (status === 401) {
        toast.error('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else {
        toast.error('로그인 중 오류가 발생했습니다.');
      }
    }
  };

  const handleSocialLogin = (provider: string) => {
    window.location.assign(`/auth/social/${provider}/redirect`);
  };

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="mb-6 text-lg font-semibold text-card-foreground">로그인</h2>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>이메일</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="admin@example.com" {...field} />
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
                <FormLabel>비밀번호</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="비밀번호 입력" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
              비밀번호를 잊으셨나요?
            </Link>
          </div>
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? '로그인 중...' : '로그인'}
          </Button>
        </form>
      </Form>

      <div className="relative my-6">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
          또는 소셜 계정으로 로그인
        </span>
      </div>

      <div className="space-y-2">
        {SOCIAL_PROVIDERS.map(({ key, label }) => (
          <Button key={key} variant="outline" className="w-full" onClick={() => handleSocialLogin(key)}>
            {label}
          </Button>
        ))}
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        계정이 없으신가요?{' '}
        <a href="/terms" className="text-primary underline-offset-4 hover:underline">
          회원가입
        </a>
      </p>
    </div>
  );
}
