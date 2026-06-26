import { useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { type AxiosError } from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import type { MeterReading } from '../-types';
import { assetKeys, fetchMeterReadings } from '../-api';
import { meterSchema, type MeterFormValues } from '../-schemas';
import { api } from '@/lib/api';
import { TextField } from './fields';

const METHOD_LABEL: Record<string, string> = {
  MANUAL: '수동',
  PHOTO: '사진',
  REMOTE: '원격',
};

export function MeterReadingSection({ assetId }: { assetId: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: readings = [], isLoading } = useQuery<MeterReading[]>({
    queryKey: assetKeys.meterReadings(assetId),
    queryFn: () => fetchMeterReadings(assetId),
  });

  const form = useForm<MeterFormValues>({
    resolver: zodResolver(meterSchema) as Resolver<MeterFormValues>,
    defaultValues: { readingDate: '', note: '' },
  });

  const addMutation = useMutation({
    mutationFn: (data: MeterFormValues) =>
      api.post(`/assets/${assetId}/meter-readings`, {
        readingDate: data.readingDate,
        blackCount: Number(data.blackCount),
        colorCount: data.colorCount,
        note: data.note || undefined,
      }),
    onSuccess: () => {
      toast.success('검침이 등록되었습니다.');
      void queryClient.invalidateQueries({ queryKey: assetKeys.meterReadings(assetId) });
      setShowForm(false);
      form.reset({ readingDate: '', note: '' });
    },
    onError: (err) => {
      const msg = (err as AxiosError<{ message?: string }>).response?.data?.message;
      toast.error(msg ?? '검침 등록 중 오류가 발생했습니다.');
    },
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">미터 리딩</h3>
        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            + 검침 추가
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      ) : readings.length > 0 ? (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="pb-1 text-left font-medium">검침일</th>
              <th className="pb-1 text-right font-medium">흑백 누적</th>
              <th className="pb-1 text-right font-medium">컬러 누적</th>
              <th className="pb-1 text-right font-medium">흑백 사용</th>
              <th className="pb-1 text-right font-medium">컬러 사용</th>
              <th className="pb-1 text-left font-medium">방법</th>
            </tr>
          </thead>
          <tbody>
            {readings.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="py-1">{new Date(r.readingDate).toLocaleDateString('ko-KR')}</td>
                <td className="py-1 text-right">{r.blackCount.toLocaleString()}</td>
                <td className="py-1 text-right">{r.colorCount?.toLocaleString() ?? '-'}</td>
                <td className="py-1 text-right">{r.blackUsage.toLocaleString()}</td>
                <td className="py-1 text-right">{r.colorUsage?.toLocaleString() ?? '-'}</td>
                <td className="py-1">{METHOD_LABEL[r.readingMethod] ?? r.readingMethod}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : !showForm ? (
        <p className="text-sm text-muted-foreground">검침 기록이 없습니다.</p>
      ) : null}

      {showForm && (
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => void addMutation.mutate(d))}
            className="rounded-md border p-3 space-y-3 bg-muted/30"
          >
            <div className="grid grid-cols-2 gap-3">
              <TextField control={form.control} name="readingDate" label="검침일" type="date" required />
              <TextField control={form.control} name="blackCount" label="흑백 누적값" type="number" min={0} required />
              <TextField
                control={form.control}
                name="colorCount"
                label="컬러 누적값"
                type="number"
                min={0}
                placeholder="없으면 비워두세요"
              />
              <TextField control={form.control} name="note" label="메모" placeholder="특이사항" />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  form.reset();
                }}
              >
                취소
              </Button>
              <Button type="submit" size="sm" disabled={addMutation.isPending}>
                {addMutation.isPending ? '등록 중...' : '등록'}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}
