import { Button } from '@/components/ui/button';

// 번호 기반 페이지네이션 컨트롤. total은 X-Total-Count 헤더에서 온다.
export function Pagination({
  page,
  limit,
  total,
  onPage,
}: {
  page: number;
  limit: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return (
    <div className="mt-3 flex items-center justify-between text-sm">
      <span className="text-muted-foreground">
        {from}-{to} / {total}
      </span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          이전
        </Button>
        <span className="text-muted-foreground">
          {page} / {pageCount}
        </span>
        <Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
          다음
        </Button>
      </div>
    </div>
  );
}
