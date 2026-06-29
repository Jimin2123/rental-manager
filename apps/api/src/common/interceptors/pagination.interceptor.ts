import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';

type Paginated = { data: unknown[]; total: number };

function isPaginated(v: unknown): v is Paginated {
  return (
    !!v && typeof v === 'object' && Array.isArray((v as Paginated).data) && typeof (v as Paginated).total === 'number'
  );
}

// 서비스가 { data, total }을 반환하면 total을 X-Total-Count 헤더로 내리고 body는 data 배열만 반환한다.
// (응답 형태를 배열로 유지 → 기존 클라이언트/E2E 비파괴. 그 외 응답은 그대로 통과.)
@Injectable()
export class PaginationInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((result: unknown) => {
        if (!isPaginated(result)) return result;
        ctx.switchToHttp().getResponse<Response>().setHeader('X-Total-Count', String(result.total));
        return result.data;
      }),
    );
  }
}
