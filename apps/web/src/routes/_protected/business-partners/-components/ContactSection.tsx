import { useState } from 'react';
import { type AxiosError } from 'axios';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/api';
import type { Contact } from '../-types';
import type { ContactFormValues } from '../-schemas';
import { ContactForm } from './ContactForm';

const toContactPayload = (data: ContactFormValues) => ({
  name: data.name,
  department: data.department || undefined,
  position: data.position || undefined,
  role: data.role || undefined,
  phone: data.phone || undefined,
  email: data.email || undefined,
  isPrimary: data.isPrimary,
  memo: data.memo || undefined,
});

export function ContactSection({
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

  const addMutation = useMutation({
    mutationFn: (data: ContactFormValues) =>
      api.post(`/business-partners/${partnerId}/contacts`, toContactPayload(data)),
    onSuccess: () => {
      toast.success('담당자가 추가되었습니다.');
      setShowAddForm(false);
      onChanged();
    },
    onError: () => toast.error('담당자 추가 중 오류가 발생했습니다.'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ contactId, data }: { contactId: string; data: ContactFormValues }) =>
      api.patch(`/business-partners/${partnerId}/contacts/${contactId}`, toContactPayload(data)),
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
