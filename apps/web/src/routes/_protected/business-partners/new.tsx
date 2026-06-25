import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type AxiosError } from 'axios';
import { useState } from 'react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { api } from '@/lib/api';
import { openKakaoAddressSearch } from '@/lib/kakao-address';

export const Route = createFileRoute('/_protected/business-partners/new')({
  component: NewBusinessPartnerPage,
});

const contactSchema = z.object({
  name: z.string().min(1, '담당자 이름을 입력해주세요.'),
  department: z.string().optional(),
  position: z.string().optional(),
  role: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('올바른 이메일을 입력해주세요.').optional().or(z.literal('')),
  isPrimary: z.boolean().optional(),
  memo: z.string().optional(),
});

const schema = z.object({
  roles: z.array(z.enum(['SALES', 'PURCHASE'])).min(1, '역할을 최소 1개 선택해주세요.'),
  businessProfile: z.object({
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
    email: z.string().email('올바른 이메일을 입력해주세요.').optional().or(z.literal('')),
    phone: z.string().optional(),
    address: z.object({
      zonecode: z.string().min(1, '주소를 검색해주세요.'),
      address: z.string().min(1, '주소를 검색해주세요.'),
      addressDetail: z.string().optional(),
      jibunAddress: z.string().optional(),
      roadAddress: z.string().optional(),
      buildingName: z.string().optional(),
    }),
  }),
  contacts: z.array(contactSchema).optional(),
  memo: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type BrnStatus = 'idle' | 'valid' | 'invalid';

const formatBrn = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
};

function NewBusinessPartnerPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [brnStatus, setBrnStatus] = useState<BrnStatus>('idle');
  const [brnMessage, setBrnMessage] = useState('');
  const [brnVerifying, setBrnVerifying] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      roles: [],
      businessProfile: {
        name: '',
        businessRegistrationNo: '',
        representativeName: '',
        businessType: '',
        businessItem: '',
        email: '',
        phone: '',
        address: { zonecode: '', address: '', addressDetail: '', jibunAddress: '', roadAddress: '', buildingName: '' },
      },
      contacts: [],
      memo: '',
    },
  });

  const {
    fields: contactFields,
    append: appendContact,
    remove: removeContact,
  } = useFieldArray({
    control: form.control,
    name: 'contacts',
  });

  const mutation = useMutation({
    mutationFn: (data: FormValues) => api.post<{ id: string }>('/business-partners', data),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['business-partners'] });
      toast.success('거래처가 등록되었습니다.');
      void navigate({ to: '/business-partners/$id', params: { id: res.data.id } });
    },
    onError: (err) => {
      const status = (err as AxiosError).response?.status;
      if (status === 409) {
        toast.error('이미 등록된 사업자번호입니다.');
      } else {
        toast.error('거래처 등록 중 오류가 발생했습니다.');
      }
    },
  });

  const handleVerifyBrn = async () => {
    const brn = form.getValues('businessProfile.businessRegistrationNo').replace(/-/g, '');
    if (brn.length !== 10) return;
    setBrnVerifying(true);
    try {
      const { data } = await api.post<{ valid: boolean; status: string }>('/organizations/brn/verify', {
        businessRegistrationNo: brn,
      });
      setBrnStatus(data.valid ? 'valid' : 'invalid');
      setBrnMessage(data.status);
      if (!data.valid) {
        form.setError('businessProfile.businessRegistrationNo', {
          message: `사용할 수 없는 사업자입니다. (${data.status})`,
        });
      } else {
        form.clearErrors('businessProfile.businessRegistrationNo');
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
      form.setValue('businessProfile.address.zonecode', result.zonecode, { shouldValidate: true });
      form.setValue('businessProfile.address.address', result.address, { shouldValidate: true });
      form.setValue('businessProfile.address.jibunAddress', result.jibunAddress);
      form.setValue('businessProfile.address.roadAddress', result.roadAddress);
      form.setValue('businessProfile.address.buildingName', result.buildingName);
    });
  };

  const onSubmit = (values: FormValues) => {
    if (brnStatus !== 'valid') {
      form.setError('businessProfile.businessRegistrationNo', {
        message: '사업자등록번호 조회를 먼저 완료해주세요.',
      });
      return;
    }
    const payload = {
      ...values,
      businessProfile: {
        ...values.businessProfile,
        businessRegistrationNo: values.businessProfile.businessRegistrationNo.replace(/-/g, ''),
        email: values.businessProfile.email || undefined,
      },
      contacts: values.contacts?.map((c) => ({ ...c, email: c.email || undefined })) ?? [],
      memo: values.memo || undefined,
    };
    void mutation.mutate(payload);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/business-partners' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">거래처 등록</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* 역할 */}
          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">
              역할 <span className="text-destructive">*</span>
            </h2>
            <div className="flex gap-6">
              {(['SALES', 'PURCHASE'] as const).map((role) => (
                <FormField
                  key={role}
                  control={form.control}
                  name="roles"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          id={`role-${role}`}
                          checked={field.value.includes(role)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              field.onChange([...field.value, role]);
                            } else {
                              field.onChange(field.value.filter((v) => v !== role));
                            }
                          }}
                        />
                      </FormControl>
                      <FormLabel htmlFor={`role-${role}`} className="cursor-pointer font-normal">
                        {role === 'SALES' ? '매출 거래처' : '매입 거래처'}
                      </FormLabel>
                    </FormItem>
                  )}
                />
              ))}
            </div>
            {form.formState.errors.roles && (
              <p className="mt-2 text-xs text-destructive">{form.formState.errors.roles.message}</p>
            )}
          </div>

          {/* 사업자 정보 */}
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <h2 className="text-sm font-semibold">사업자 정보</h2>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="businessProfile.name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      상호명 <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="(주)거래처명" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="businessProfile.businessRegistrationNo"
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
                        onClick={() => void handleVerifyBrn()}
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
              name="businessProfile.representativeName"
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
                name="businessProfile.businessType"
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
                name="businessProfile.businessItem"
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
                name="businessProfile.phone"
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
                name="businessProfile.email"
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
              <p className="text-sm font-medium">
                주소 <span className="text-destructive">*</span>
              </p>
              <div className="flex gap-2">
                <FormField
                  control={form.control}
                  name="businessProfile.address.zonecode"
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
                name="businessProfile.address.address"
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
                name="businessProfile.address.addressDetail"
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
          </div>

          {/* 담당자 */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">담당자</h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  appendContact({
                    name: '',
                    department: '',
                    position: '',
                    role: '',
                    phone: '',
                    email: '',
                    isPrimary: false,
                    memo: '',
                  })
                }
              >
                + 담당자 추가
              </Button>
            </div>

            {contactFields.length === 0 && (
              <p className="text-xs text-muted-foreground">담당자를 추가하면 거래처와 함께 저장됩니다.</p>
            )}

            {contactFields.map((field, index) => (
              <div key={field.id} className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">담당자 {index + 1}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeContact(index)}>
                    삭제
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name={`contacts.${index}.name`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel>
                          이름 <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="홍길동" {...f} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`contacts.${index}.department`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel>부서</FormLabel>
                        <FormControl>
                          <Input placeholder="영업부" {...f} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`contacts.${index}.position`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel>직급</FormLabel>
                        <FormControl>
                          <Input placeholder="과장" {...f} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`contacts.${index}.role`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel>역할</FormLabel>
                        <FormControl>
                          <Input placeholder="계약 담당자" {...f} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`contacts.${index}.phone`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel>전화</FormLabel>
                        <FormControl>
                          <Input placeholder="010-1234-5678" {...f} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`contacts.${index}.email`}
                    render={({ field: f }) => (
                      <FormItem>
                        <FormLabel>이메일</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="hong@company.com" {...f} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name={`contacts.${index}.isPrimary`}
                  render={({ field: f }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox checked={f.value} onCheckedChange={f.onChange} />
                      </FormControl>
                      <FormLabel className="cursor-pointer font-normal text-sm">대표 담당자</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            ))}
          </div>

          {/* 메모 */}
          <div className="rounded-lg border bg-card p-4">
            <FormField
              control={form.control}
              name="memo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>메모</FormLabel>
                  <FormControl>
                    <Input placeholder="내부 메모 (선택)" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => void navigate({ to: '/business-partners' })}>
              취소
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? '저장 중...' : '등록'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
