import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type AxiosError } from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { api } from '@/lib/api';

export const Route = createFileRoute('/_auth/reset-password')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search['token'] === 'string' ? search['token'] : undefined,
  }),
  component: ResetPasswordPage,
});

const schema = z
  .object({
    password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.').max(72, '비밀번호는 72자 이하여야 합니다.'),
    passwordConfirm: z.string().min(1, '비밀번호 확인을 입력해주세요.'),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['passwordConfirm'],
  });

type FormValues = z.infer<typeof schema>;

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', passwordConfirm: '' },
  });

  if (!token) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm text-center space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground">유효하지 않은 링크</h2>
        <p className="text-sm text-muted-foreground">비밀번호 재설정 링크가 올바르지 않습니다.</p>
        <Link to="/forgot-password" className="text-sm text-primary underline-offset-4 hover:underline">
          비밀번호 찾기로 돌아가기
        </Link>
      </div>
    );
  }

  const onSubmit = async (values: FormValues) => {
    try {
      await api.post('/auth/password/reset', { token, newPassword: values.password });
      toast.success('비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.');
      void navigate({ to: '/login', search: { error: undefined } });
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      if (status === 400) {
        toast.error('링크가 만료되었거나 유효하지 않습니다.');
      } else {
        toast.error('비밀번호 재설정 중 오류가 발생했습니다.');
      }
    }
  };

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="mb-6 text-lg font-semibold text-card-foreground">새 비밀번호 설정</h2>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>새 비밀번호</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="8자 이상" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="passwordConfirm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>비밀번호 확인</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="비밀번호 재입력" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? '변경 중...' : '비밀번호 변경'}
          </Button>
        </form>
      </Form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        링크가 만료됐나요?{' '}
        <Link to="/forgot-password" className="text-primary underline-offset-4 hover:underline">
          다시 요청하기
        </Link>
      </p>
    </div>
  );
}
