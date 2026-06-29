import { type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// 앱 전역 native <select> 래퍼 — 여러 파일에 복붙되던 selectClass를 단일화한다.
// 기본은 w-full. 폭을 바꾸려면 className으로 w-auto 등 전달(cn/twMerge가 병합).
export function NativeSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm focus:outline-none',
        className,
      )}
      {...props}
    />
  );
}
