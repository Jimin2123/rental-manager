import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type AxiosError } from 'axios';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import { openKakaoAddressSearch } from '@/lib/kakao-address';
import { useAuthStore } from '@/store/auth.store';
import type { Organization } from '@/store/auth.store';

export const Route = createFileRoute('/_auth/register')({
  beforeLoad: () => {
    const { currentOrganization } = useAuthStore.getState();
    if (currentOrganization) throw redirect({ to: '/' });
    if (!sessionStorage.getItem('terms_agreed')) throw redirect({ to: '/terms' });
  },
  component: RegisterPage,
});

const registerSchema = z
  .object({
    // 계정 정보
    email: z.string().email('올바른 이메일을 입력해주세요.'),
    password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.').max(72, '비밀번호는 72자 이하여야 합니다.'),
    passwordConfirm: z.string().min(1, '비밀번호 확인을 입력해주세요.'),
    // 사용자 정보
    memberName: z.string().min(1, '이름을 입력해주세요.'),
    // 사업자 정보
    name: z.string().min(1, '상호명을 입력해주세요.'),
    businessRegistrationNo: z
      .string()
      .refine(
        (v) => /^\d{3}-\d{2}-\d{5}$/.test(v) || /^\d{10}$/.test(v),
        '올바른 사업자등록번호를 입력해주세요. (예: 123-45-67890)',
      ),
    representativeName: z.string().min(1, '대표자명을 입력해주세요.'),
    businessType: z.string().optional(),
    businessItem: z.string().optional(),
    orgEmail: z.string().email('올바른 이메일을 입력해주세요.').optional().or(z.literal('')),
    orgPhone: z.string().optional(),
    // 주소
    zonecode: z.string().min(1, '주소를 검색해주세요.'),
    address: z.string().min(1, '주소를 검색해주세요.'),
    addressDetail: z.string().optional(),
    jibunAddress: z.string().optional(),
    roadAddress: z.string().optional(),
    buildingName: z.string().optional(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['passwordConfirm'],
  });

type RegisterForm = z.infer<typeof registerSchema>;

const formatBrn = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
};

type BrnStatus = 'idle' | 'valid' | 'invalid';

function RegisterPage() {
  const navigate = useNavigate();
  const [brnStatus, setBrnStatus] = useState<BrnStatus>('idle');
  const [brnMessage, setBrnMessage] = useState('');
  const [brnVerifying, setBrnVerifying] = useState(false);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      passwordConfirm: '',
      memberName: '',
      name: '',
      businessRegistrationNo: '',
      representativeName: '',
      businessType: '',
      businessItem: '',
      orgEmail: '',
      orgPhone: '',
      zonecode: '',
      address: '',
      addressDetail: '',
      jibunAddress: '',
      roadAddress: '',
      buildingName: '',
    },
  });

  const handleVerifyBrn = async () => {
    const brn = form.getValues('businessRegistrationNo').replace(/-/g, '');
    if (brn.length !== 10) return;
    setBrnVerifying(true);
    try {
      const { data } = await api.post<{ valid: boolean; status: string }>('/organizations/brn/verify', {
        businessRegistrationNo: brn,
      });
      setBrnStatus(data.valid ? 'valid' : 'invalid');
      setBrnMessage(data.status);
      if (!data.valid) {
        form.setError('businessRegistrationNo', { message: `사용할 수 없는 사업자입니다. (${data.status})` });
      } else {
        form.clearErrors('businessRegistrationNo');
      }
    } catch {
      setBrnStatus('invalid');
      setBrnMessage('조회 실패');
      toast.error('사업자등록번호 조회 중 오류가 발생했습니다.');
    } finally {
      setBrnVerifying(false);
    }
  };

  const handleAddressSearch = () => {
    openKakaoAddressSearch((result) => {
      form.setValue('zonecode', result.zonecode, { shouldValidate: true });
      form.setValue('address', result.address, { shouldValidate: true });
      form.setValue('jibunAddress', result.jibunAddress);
      form.setValue('roadAddress', result.roadAddress);
      form.setValue('buildingName', result.buildingName);
    });
  };

  const onSubmit = async (values: RegisterForm) => {
    if (brnStatus !== 'valid') {
      form.setError('businessRegistrationNo', { message: '사업자등록번호 조회를 먼저 완료해주세요.' });
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordConfirm, ...payload } = values;
      const { data } = await api.post<Organization[]>('/auth/signup', {
        ...payload,
        businessRegistrationNo: payload.businessRegistrationNo.replace(/-/g, ''),
        orgEmail: payload.orgEmail || undefined,
      });
      useAuthStore.getState().setAuth(data);
      sessionStorage.removeItem('terms_agreed');
      await navigate({ to: '/' });
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      if (status === 409) {
        toast.error('이미 사용 중인 이메일입니다.');
        form.setError('email', { message: '이미 사용 중인 이메일입니다.' });
      } else {
        toast.error('회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      }
    }
  };

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="mb-6 text-lg font-semibold text-card-foreground">회원가입</h2>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
          {/* 계정 정보 */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">계정 정보</h3>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    이메일 <span className="text-destructive">*</span>
                  </FormLabel>
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
                  <FormLabel>
                    비밀번호 <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="8자 이상 입력" {...field} />
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
                  <FormLabel>
                    비밀번호 확인 <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="비밀번호 재입력" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          <Separator />

          {/* 사용자 정보 */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">사용자 정보</h3>
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
          </section>

          <Separator />

          {/* 사업자 정보 */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground">사업자 정보</h3>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      상호명 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="(주)렌탈회사" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="businessRegistrationNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      사업자등록번호 <span className="text-destructive">*</span>
                    </FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input
                          placeholder="123-45-67890"
                          maxLength={12}
                          {...field}
                          onChange={(e) => {
                            field.onChange(formatBrn(e.target.value));
                            setBrnStatus('idle');
                          }}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={field.value.replace(/-/g, '').length !== 10 || brnVerifying}
                        onClick={handleVerifyBrn}
                      >
                        {brnVerifying ? '조회 중...' : '조회'}
                      </Button>
                    </div>
                    <FormMessage />
                    {brnStatus !== 'idle' && (
                      <p className={`text-xs ${brnStatus === 'valid' ? 'text-green-600' : 'text-destructive'}`}>
                        {brnStatus === 'valid' ? `✓ ${brnMessage}` : `✗ ${brnMessage}`}
                      </p>
                    )}
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="representativeName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    대표자명 <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="홍길동" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="businessType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>업태</FormLabel>
                    <FormControl>
                      <Input placeholder="서비스업" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="businessItem"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>종목</FormLabel>
                    <FormControl>
                      <Input placeholder="렌탈업" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="orgPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>대표전화</FormLabel>
                    <FormControl>
                      <Input placeholder="02-1234-5678" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="orgEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>대표이메일</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contact@company.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 주소 */}
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">
                주소 <span className="text-destructive">*</span>
              </label>
              <div className="flex gap-2">
                <FormField
                  control={form.control}
                  name="zonecode"
                  render={({ field }) => (
                    <FormItem className="w-28 shrink-0">
                      <FormControl>
                        <Input placeholder="우편번호" readOnly {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="button" variant="outline" onClick={handleAddressSearch}>
                  주소 검색
                </Button>
              </div>
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="기본주소" readOnly {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="addressDetail"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input placeholder="상세주소 (선택)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? '가입 중...' : '가입하기'}
          </Button>
        </form>
      </Form>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        이미 계정이 있으신가요?{' '}
        <a href="/login" className="text-primary underline-offset-4 hover:underline">
          로그인
        </a>
      </p>
    </div>
  );
}
