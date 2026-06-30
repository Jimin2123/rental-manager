import { useState } from 'react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toastApiError } from '@/lib/api-error';
import { createDepositAccount, updateDepositAccount, invalidateDepositAccounts } from '../-api';
import { depositAccountSchema } from '../-schemas';
import type { DepositAccount } from '../-types';

type Props = { editing?: DepositAccount; onDone: () => void };

export function DepositAccountForm({ editing, onDone }: Props) {
  const qc = useQueryClient();
  const [bankName, setBankName] = useState(editing?.bankName ?? '');
  const [accountNumber, setAccountNumber] = useState(editing?.accountNumber ?? '');
  const [accountHolder, setAccountHolder] = useState(editing?.accountHolder ?? '');
  const [label, setLabel] = useState(editing?.label ?? '');
  const [isDefault, setIsDefault] = useState(editing?.isDefault ?? false);
  const [isActive, setIsActive] = useState(editing?.isActive ?? true);
  const [memo, setMemo] = useState(editing?.memo ?? '');

  const mutation = useMutation({
    mutationFn: () => {
      const parsed = depositAccountSchema.parse({
        bankName,
        accountNumber,
        accountHolder,
        label: label || undefined,
        isDefault: isDefault || undefined,
        isActive,
        memo: memo || undefined,
      });
      return editing ? updateDepositAccount(editing.id, parsed) : createDepositAccount(parsed);
    },
    onSuccess: () => {
      invalidateDepositAccounts(qc);
      toast.success(editing ? '입금계좌가 수정되었습니다.' : '입금계좌가 등록되었습니다.');
      onDone();
    },
    onError: (err) => toastApiError(err, '입금계좌 저장 중 오류가 발생했습니다.'),
  });

  const submittable = bankName.trim() !== '' && accountNumber.trim() !== '' && accountHolder.trim() !== '';

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-sm">
          <span className="font-medium">은행명 *</span>
          <Input value={bankName} onChange={(e) => setBankName(e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">계좌번호 *</span>
          <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">예금주 *</span>
          <Input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">표시명</span>
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        <label className="space-y-1 text-sm col-span-2">
          <span className="font-medium">메모</span>
          <Input value={memo} onChange={(e) => setMemo(e.target.value)} />
        </label>
      </div>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> 기본계좌
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> 활성
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone}>
          취소
        </Button>
        <Button disabled={!submittable || mutation.isPending} onClick={() => mutation.mutate()}>
          {editing ? '수정' : '등록'}
        </Button>
      </div>
    </div>
  );
}
