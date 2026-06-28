import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { CustomerType } from '../-types';
import { CUSTOMER_TYPE_LABEL } from '../-types';
import { IndividualForm } from './IndividualForm';
import { BusinessForm } from './BusinessForm';

// 고객 등록: 개인/법인 선택. 법인은 기존 거래처를 연결한다(거래처는 별도 마스터).
export function CustomerForm() {
  const [type, setType] = useState<CustomerType>('INDIVIDUAL');

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">
          고객 유형 <span className="text-destructive">*</span>
        </p>
        <div className="flex gap-2">
          {(['INDIVIDUAL', 'BUSINESS'] as const).map((t) => (
            <Button
              key={t}
              type="button"
              variant={type === t ? 'default' : 'outline'}
              size="sm"
              onClick={() => setType(t)}
            >
              {CUSTOMER_TYPE_LABEL[t]}
            </Button>
          ))}
        </div>
      </div>

      {type === 'INDIVIDUAL' ? <IndividualForm /> : <BusinessForm />}
    </div>
  );
}
