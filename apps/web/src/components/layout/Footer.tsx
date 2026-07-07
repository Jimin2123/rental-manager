import { cn } from '@/lib/utils';

type FooterProps = {
  className?: string;
};

export function Footer({ className }: FooterProps) {
  return (
    <footer
      className={cn(
        'flex h-[34px] flex-none items-center justify-center gap-3 border-t px-7 text-xs text-muted-foreground',
        className,
      )}
    >
      <span>© 2025 셀렌트</span>
      <span>·</span>
      <a href="#" className="hover:text-foreground">
        이용약관
      </a>
      <span>·</span>
      <a href="#" className="hover:text-foreground">
        개인정보처리방침
      </a>
      <span>·</span>
      <a href="#" className="hover:text-foreground">
        고객센터
      </a>
    </footer>
  );
}
