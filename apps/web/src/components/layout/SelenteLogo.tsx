import logo from '@/assets/logo.png';
import { cn } from '@/lib/utils';

export function SelenteLogo({ className }: { className?: string }) {
  return (
    <svg
      width="108"
      height="46"
      viewBox="0 0 108 46"
      className={cn('flex-none', className)}
      aria-label="셀렌트"
      role="img"
    >
      <image href={logo} x="0" y="0" width="46" height="46" />
      <text x="50" y="30" fontSize="17" fontWeight="700" fontFamily="inherit" fill="currentColor">
        셀렌트
      </text>
    </svg>
  );
}
