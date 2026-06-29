import { Button } from '@/components/ui/button';

/** 목록 필터 버튼 행 — 라벨 + 선택형 버튼들. 도메인 목록 화면 공용. */
export function FilterRow<T extends string>({
  label,
  options,
  value,
  onChange,
  labelOf,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  labelOf: (v: T) => string;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="mr-1 w-10 text-xs text-muted-foreground">{label}</span>
      {options.map((o) => (
        <Button key={o} variant={value === o ? 'default' : 'outline'} size="sm" onClick={() => onChange(o)}>
          {labelOf(o)}
        </Button>
      ))}
    </div>
  );
}
