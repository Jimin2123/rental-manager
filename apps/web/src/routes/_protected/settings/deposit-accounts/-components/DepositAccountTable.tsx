import { useState } from 'react';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { toastApiError } from '@/lib/api-error';
import {
  depositAccountKeys,
  fetchDepositAccounts,
  deleteDepositAccount,
  invalidateDepositAccounts,
} from '../-api';
import type { DepositAccount } from '../-types';
import { DepositAccountForm } from './DepositAccountForm';

export function DepositAccountTable() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<DepositAccount | null>(null);

  const { data: accounts = [] } = useQuery({
    queryKey: depositAccountKeys.list(true),
    queryFn: () => fetchDepositAccounts(true),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteDepositAccount(id),
    onSuccess: () => {
      invalidateDepositAccounts(qc);
      toast.success('입금계좌가 삭제되었습니다.');
    },
    onError: (err) => toastApiError(err, '삭제 중 오류가 발생했습니다.'),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>입금계좌 추가</Button>
      </div>
      {creating && <DepositAccountForm onDone={() => setCreating(false)} />}
      {editing && <DepositAccountForm editing={editing} onDone={() => setEditing(null)} />}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2">은행명</th>
            <th>계좌번호</th>
            <th>예금주</th>
            <th>표시명</th>
            <th>상태</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id} className="border-b">
              <td className="py-2">{a.bankName}</td>
              <td>{a.accountNumber}</td>
              <td>{a.accountHolder}</td>
              <td>{a.label ?? '-'}</td>
              <td>
                {a.isDefault && <span className="mr-1 rounded bg-primary/10 px-1 text-primary">기본</span>}
                {a.isActive ? '활성' : '비활성'}
              </td>
              <td className="text-right">
                <Button variant="outline" onClick={() => setEditing(a)}>
                  수정
                </Button>
                <Button variant="outline" onClick={() => del.mutate(a.id)}>
                  삭제
                </Button>
              </td>
            </tr>
          ))}
          {accounts.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-muted-foreground">
                등록된 입금계좌가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
