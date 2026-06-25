import { createFileRoute, Link } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { api } from '@/lib/api';

export const Route = createFileRoute('/_auth/forgot-password')({
  component: ForgotPasswordPage,
});

const schema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요.'),
});

type FormValues = z.infer<typeof schema>;

function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await api.post('/auth/password/reset/send', { email: values.email });
    } catch {
      // 이메일 존재 여부 노출 방지 — 실패해도 성공 화면 표시
    } finally {
      setSent(true);
    }
  };

  if (sent) {
    return (
      <div className="rounded-lg border bg-card p-6 shadow-sm text-center space-y-4">
        <h2 className="text-lg font-semibold text-card-foreground">이메일을 확인해주세요</h2>
        <p className="text-sm text-muted-foreground">
          비밀번호 재설정 링크를 발송했습니다. 이메일을 확인해주세요.
        </p>
        <Link to="/login" search={{ error: undefined }} className="text-sm text-primary underline-offset-4 hover:underline">
          로그인으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="mb-2 text-lg font-semibold text-card-foreground">비밀번호 찾기</h2>
      <p className="mb-6 text-sm text-muted-foreground">
        가입한 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다.
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>이메일</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="가입한 이메일 주소" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? '발송 중...' : '재설정 링크 발송'}
          </Button>
        </form>
      </Form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link to="/login" search={{ error: undefined }} className="text-primary underline-offset-4 hover:underline">
          로그인으로 돌아가기
        </Link>
      </p>
    </div>
  );
}
