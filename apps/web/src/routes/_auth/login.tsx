import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type AxiosError } from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import type { Organization } from '@/store/auth.store';

export const Route = createFileRoute('/_auth/login')({
  beforeLoad: () => {
    const { currentOrganization } = useAuthStore.getState();
    if (currentOrganization) throw redirect({ to: '/' });
  },
  component: LoginPage,
});

const loginSchema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요.'),
  password: z.string().min(1, '비밀번호를 입력해주세요.'),
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginPage() {
  const navigate = useNavigate();
  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginForm) => {
    try {
      const { data } = await api.post<Organization[]>('/auth/login', values);
      useAuthStore.getState().setAuth(data);
      await navigate({ to: '/' });
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      if (status === 401) {
        toast.error('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else {
        toast.error('로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
    }
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
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? '로그인 중...' : '로그인'}
          </Button>
        </form>
      </Form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        계정이 없으신가요?{' '}
        <a href="/terms" className="text-primary underline-offset-4 hover:underline">
          회원가입
        </a>
      </p>
    </div>
  );
}
