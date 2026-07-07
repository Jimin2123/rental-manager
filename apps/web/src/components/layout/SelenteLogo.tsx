import { cn } from '@/lib/utils';

type SelenteLogoProps = {
  size?: number;
  className?: string;
};

export function SelenteLogo({ size = 28, className }: SelenteLogoProps) {
  const iconSize = Math.round(size * 0.62);

  return (
    <div
      className={cn('flex flex-none items-center justify-center rounded-xl bg-primary', className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" fill="none" style={{ width: iconSize, height: iconSize }} aria-hidden="true">
        {/* 상단 호 — 자산(asset) 영역 */}
        <path
          d="M17 8C17 5.239 14.761 3 12 3H10C7.239 3 5 5.239 5 8C5 10.209 6.791 12 9 12H15"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* 하단 호 — 고객(customer) 영역, 반대 방향으로 흘러 S를 완성 */}
        <path
          d="M9 12H15C17.209 12 19 13.791 19 16C19 18.761 16.761 21 14 21H12C9.239 21 7 18.761 7 16"
          stroke="white"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
