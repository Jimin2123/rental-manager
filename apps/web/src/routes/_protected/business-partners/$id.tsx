import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { type AxiosError } from 'axios';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { api } from '@/lib/api';
import type { BusinessPartnerDetail, Contact } from './-types';
import { ROLE_LABEL } from './-types';

export const Route = createFileRoute('/_protected/business-partners/$id')({
  component: BusinessPartnerDetailPage,
});

// ─── 편집 폼 스키마 ───────────────────────────────────────────────
const editSchema = z.object({
  roles: z.array(z.enum(['SALES', 'PURCHASE'])).min(1, '역할을 최소 1개 선택해주세요.'),
  memo: z.string().optional(),
  businessProfile: z.object({
    name: z.string().min(1, '상호명을 입력해주세요.'),
    representativeName: z.string().min(1, '대표자명을 입력해주세요.'),
    businessType: z.string().optional(),
    businessItem: z.string().optional(),
    email: z.string().email('올바른 이메일을 입력해주세요.').optional().or(z.literal('')),
    phone: z.string().optional(),
    address: z.object({
      zonecode: z.string().optional(),
      address: z.string().optional(),
      addressDetail: z.string().optional(),
    }),
  }),
});
type EditFormValues = z.infer<typeof editSchema>;

// ─── 담당자 폼 스키마 ─────────────────────────────────────────────
const contactSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요.'),
  department: z.string().optional(),
  position: z.string().optional(),
  role: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('올바른 이메일을 입력해주세요.').optional().or(z.literal('')),
  isPrimary: z.boolean().default(false),
});
type ContactFormValues = z.infer<typeof contactSchema>;

// ─── 메인 페이지 컴포넌트 ─────────────────────────────────────────
function BusinessPartnerDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const { data: partner, isLoading } = useQuery<BusinessPartnerDetail>({
    queryKey: ['business-partners', 'detail', id],
    queryFn: () => api.get<BusinessPartnerDetail>(`/business-partners/${id}`).then((r) => r.data),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['business-partners', 'detail', id] });
    void queryClient.invalidateQueries({ queryKey: ['business-partners'] });
  };

  if (isLoading) {
    return <div className="p-6 text-muted-foreground">불러오는 중...</div>;
  }
  if (!partner) {
    return <div className="p-6 text-muted-foreground">거래처를 찾을 수 없습니다.</div>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/business-partners' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">{partner.businessProfile.name}</h1>
      </div>

      {isEditing ? (
        <EditForm
          partner={partner}
          onCancel={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false);
            invalidate();
          }}
          onContactChanged={invalidate}
        />
      ) : (
        <DetailView partner={partner} onEdit={() => setIsEditing(true)} onChanged={invalidate} navigate={navigate} />
      )}
    </div>
  );
}

// ─── 읽기 전용 뷰 ─────────────────────────────────────────────────
function DetailView({
  partner,
  onEdit,
  onChanged,
  navigate,
}: {
  partner: BusinessPartnerDetail;
  onEdit: () => void;
  onChanged: () => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const queryClient = useQueryClient();

  const toggleActive = useMutation({
    mutationFn: () => api.patch(`/business-partners/${partner.id}`, { isActive: !partner.isActive }),
    onSuccess: () => {
      toast.success(partner.isActive ? '거래 정지 처리되었습니다.' : '거래 재개 처리되었습니다.');
      onChanged();
    },
    onError: () => toast.error('상태 변경 중 오류가 발생했습니다.'),
  });

  const softDelete = useMutation({
    mutationFn: () => api.delete(`/business-partners/${partner.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business-partners'] });
      toast.success('거래처가 삭제되었습니다.');
      void navigate({ to: '/business-partners' });
    },
    onError: () => toast.error('삭제 중 오류가 발생했습니다.'),
  });

  const bp = partner.businessProfile;

  return (
    <div className="space-y-4">
      {/* 액션 버튼 */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void toggleActive.mutate()}
          disabled={toggleActive.isPending}
        >
          {partner.isActive ? '거래 정지' : '거래 재개'}
        </Button>
        <Button size="sm" onClick={onEdit}>
          수정
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm">
              삭제
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>거래처 삭제</DialogTitle>
              <DialogDescription>
                &ldquo;{bp.name}&rdquo;을(를) 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogTrigger asChild>
                <Button variant="outline">취소</Button>
              </DialogTrigger>
              <Button variant="destructive" onClick={() => void softDelete.mutate()} disabled={softDelete.isPending}>
                {softDelete.isPending ? '삭제 중...' : '삭제'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 사업자 정보 */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold">사업자 정보</h2>
        <Separator />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">상호명</dt>
            <dd className="font-medium">{bp.name}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">사업자번호</dt>
            <dd>{bp.businessRegistrationNo}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">대표자명</dt>
            <dd>{bp.representativeName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">상태</dt>
            <dd>
              <Badge variant={partner.isActive ? 'default' : 'outline'}>{partner.isActive ? '활성' : '거래정지'}</Badge>
            </dd>
          </div>
          {bp.businessType && (
            <div>
              <dt className="text-muted-foreground">업태</dt>
              <dd>{bp.businessType}</dd>
            </div>
          )}
          {bp.businessItem && (
            <div>
              <dt className="text-muted-foreground">종목</dt>
              <dd>{bp.businessItem}</dd>
            </div>
          )}
          {bp.phone && (
            <div>
              <dt className="text-muted-foreground">대표전화</dt>
              <dd>{bp.phone}</dd>
            </div>
          )}
          {bp.email && (
            <div>
              <dt className="text-muted-foreground">대표이메일</dt>
              <dd>{bp.email}</dd>
            </div>
          )}
          <div className="col-span-2">
            <dt className="text-muted-foreground">주소</dt>
            <dd>
              {bp.address.address}
              {bp.address.addressDetail ? ` ${bp.address.addressDetail}` : ''} ({bp.address.zonecode})
            </dd>
          </div>
        </dl>
        <div>
          <span className="text-xs text-muted-foreground mr-2">역할</span>
          {partner.roles.map((r) => (
            <Badge key={r.id} variant={r.type === 'SALES' ? 'default' : 'secondary'} className="mr-1">
              {ROLE_LABEL[r.type]}
            </Badge>
          ))}
        </div>
        {partner.memo && <p className="text-sm text-muted-foreground">메모: {partner.memo}</p>}
      </div>

      {/* 담당자 */}
      <ContactSection partnerId={partner.id} contacts={partner.contacts} onChanged={onChanged} />
    </div>
  );
}

// ─── 담당자 섹션 ──────────────────────────────────────────────────
function ContactSection({
  partnerId,
  contacts,
  onChanged,
}: {
  partnerId: string;
  contacts: Contact[];
  onChanged: () => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const normalizeContact = (data: ContactFormValues) => ({
    ...data,
    email: data.email || undefined,
    department: data.department || undefined,
    position: data.position || undefined,
    role: data.role || undefined,
    phone: data.phone || undefined,
  });

  const addMutation = useMutation({
    mutationFn: (data: ContactFormValues) =>
      api.post(`/business-partners/${partnerId}/contacts`, normalizeContact(data)),
    onSuccess: () => {
      toast.success('담당자가 추가되었습니다.');
      setShowAddForm(false);
      onChanged();
    },
    onError: () => toast.error('담당자 추가 중 오류가 발생했습니다.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ contactId, data }: { contactId: string; data: ContactFormValues }) =>
      api.patch(`/business-partners/${partnerId}/contacts/${contactId}`, normalizeContact(data)),
    onSuccess: () => {
      toast.success('담당자 정보가 수정되었습니다.');
      setEditingId(null);
      onChanged();
    },
    onError: () => toast.error('담당자 수정 중 오류가 발생했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (contactId: string) => api.delete(`/business-partners/${partnerId}/contacts/${contactId}`),
    onSuccess: () => {
      toast.success('담당자가 삭제되었습니다.');
      onChanged();
    },
    onError: (err) => {
      const status = (err as AxiosError).response?.status;
      if (status === 409) {
        toast.error('해당 담당자를 참조하는 배정이 있어 삭제할 수 없습니다.');
      } else {
        toast.error('담당자 삭제 중 오류가 발생했습니다.');
      }
    },
  });

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">담당자 ({contacts.length}명)</h2>
        {!showAddForm && (
          <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
            + 담당자 추가
          </Button>
        )}
      </div>

      {contacts.length > 0 && <Separator />}

      {contacts.map((contact) =>
        editingId === contact.id ? (
          <ContactForm
            key={contact.id}
            defaultValues={{
              name: contact.name,
              department: contact.department ?? '',
              position: contact.position ?? '',
              role: contact.role ?? '',
              phone: contact.phone ?? '',
              email: contact.email ?? '',
              isPrimary: contact.isPrimary,
            }}
            onSubmit={(data) => void updateMutation.mutate({ contactId: contact.id, data })}
            onCancel={() => setEditingId(null)}
            isPending={updateMutation.isPending}
            submitLabel="저장"
          />
        ) : (
          <div key={contact.id} className="flex items-start justify-between rounded-md border p-3 text-sm">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-medium">{contact.name}</span>
                {contact.isPrimary && (
                  <Badge variant="outline" className="text-xs">
                    대표
                  </Badge>
                )}
              </div>
              {(contact.department || contact.position) && (
                <p className="text-muted-foreground text-xs">
                  {[contact.department, contact.position].filter(Boolean).join(' · ')}
                </p>
              )}
              {contact.phone && <p className="text-muted-foreground text-xs">{contact.phone}</p>}
              {contact.email && <p className="text-muted-foreground text-xs">{contact.email}</p>}
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setEditingId(contact.id)}>
                수정
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => void deleteMutation.mutate(contact.id)}
                disabled={deleteMutation.isPending}
              >
                삭제
              </Button>
            </div>
          </div>
        ),
      )}

      {showAddForm && (
        <ContactForm
          defaultValues={{ name: '', department: '', position: '', role: '', phone: '', email: '', isPrimary: false }}
          onSubmit={(data) => void addMutation.mutate(data)}
          onCancel={() => setShowAddForm(false)}
          isPending={addMutation.isPending}
          submitLabel="추가"
        />
      )}
    </div>
  );
}

// ─── 담당자 입력 폼 (추가/수정 공용) ─────────────────────────────
function ContactForm({
  defaultValues,
  onSubmit,
  onCancel,
  isPending,
  submitLabel,
}: {
  defaultValues: ContactFormValues;
  onSubmit: (data: ContactFormValues) => void;
  onCancel: () => void;
  isPending: boolean;
  submitLabel: string;
}) {
  const form = useForm<z.input<typeof contactSchema>, unknown, ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <div className="rounded-md border p-3 space-y-3 bg-muted/30">
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="name"
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
            name="department"
            render={({ field }) => (
              <FormItem>
                <FormLabel>부서</FormLabel>
                <FormControl>
                  <Input placeholder="영업부" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="position"
            render={({ field }) => (
              <FormItem>
                <FormLabel>직급</FormLabel>
                <FormControl>
                  <Input placeholder="과장" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>역할</FormLabel>
                <FormControl>
                  <Input placeholder="계약 담당자" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>전화</FormLabel>
                <FormControl>
                  <Input placeholder="010-1234-5678" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>이메일</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="hong@company.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="isPrimary"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="cursor-pointer font-normal text-sm">대표 담당자</FormLabel>
            </FormItem>
          )}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            취소
          </Button>
          <Button type="button" size="sm" onClick={form.handleSubmit(onSubmit)} disabled={isPending}>
            {isPending ? '처리 중...' : submitLabel}
          </Button>
        </div>
      </div>
    </Form>
  );
}

// ─── 편집 폼 ──────────────────────────────────────────────────────
function EditForm({
  partner,
  onCancel,
  onSaved,
  onContactChanged,
}: {
  partner: BusinessPartnerDetail;
  onCancel: () => void;
  onSaved: () => void;
  onContactChanged: () => void;
}) {
  const bp = partner.businessProfile;
  const form = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      roles: partner.roles.map((r) => r.type),
      memo: partner.memo ?? '',
      businessProfile: {
        name: bp.name,
        representativeName: bp.representativeName,
        businessType: bp.businessType ?? '',
        businessItem: bp.businessItem ?? '',
        email: bp.email ?? '',
        phone: bp.phone ?? '',
        address: {
          zonecode: bp.address.zonecode,
          address: bp.address.address,
          addressDetail: bp.address.addressDetail ?? '',
        },
      },
    },
  });

  const mutation = useMutation({
    mutationFn: (data: EditFormValues) =>
      api.patch(`/business-partners/${partner.id}`, {
        roles: data.roles,
        memo: data.memo || undefined,
        businessProfile: {
          name: data.businessProfile.name,
          representativeName: data.businessProfile.representativeName,
          businessType: data.businessProfile.businessType || undefined,
          businessItem: data.businessProfile.businessItem || undefined,
          email: data.businessProfile.email || undefined,
          phone: data.businessProfile.phone || undefined,
          address: {
            zonecode: data.businessProfile.address.zonecode || undefined,
            address: data.businessProfile.address.address || undefined,
            addressDetail: data.businessProfile.address.addressDetail || undefined,
          },
        },
      }),
    onSuccess: () => {
      toast.success('거래처 정보가 수정되었습니다.');
      onSaved();
    },
    onError: (err) => {
      const status = (err as AxiosError).response?.status;
      const message = (err as AxiosError<{ message?: string }>).response?.data?.message;
      if (status === 409 && message) {
        toast.error(message);
      } else {
        toast.error('수정 중 오류가 발생했습니다.');
      }
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((d) => void mutation.mutate(d))} className="space-y-4">
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
                        id={`edit-role-${role}`}
                        checked={field.value.includes(role)}
                        onCheckedChange={(checked) => {
                          if (checked) field.onChange([...field.value, role]);
                          else field.onChange(field.value.filter((v) => v !== role));
                        }}
                      />
                    </FormControl>
                    <FormLabel htmlFor={`edit-role-${role}`} className="cursor-pointer font-normal">
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <p className="text-sm font-medium mb-1.5">사업자등록번호</p>
              <p className="text-sm text-muted-foreground border rounded-md px-3 py-2 bg-muted/50">
                {partner.businessProfile.businessRegistrationNo}
              </p>
              <p className="text-xs text-muted-foreground mt-1">사업자번호는 수정할 수 없습니다.</p>
            </div>
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
                  <Input {...field} />
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
                    <Input {...field} />
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
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="businessProfile.phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>대표전화</FormLabel>
                  <FormControl>
                    <Input {...field} />
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
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
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
                  <Input placeholder="내부 메모" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* 담당자 섹션 — 편집 모드에서도 항상 표시 */}
        <ContactSection partnerId={partner.id} contacts={partner.contacts} onChanged={onContactChanged} />

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? '저장 중...' : '저장'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
