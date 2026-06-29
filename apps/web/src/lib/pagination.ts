import type { AxiosResponse } from 'axios';

// 목록 공통 페이지 크기 + X-Total-Count 헤더 파싱.
export const PAGE_SIZE = 20;

export type Paginated<T> = { data: T[]; total: number };

export function paginated<T>(r: AxiosResponse<T[]>): Paginated<T> {
  const total = Number(r.headers['x-total-count']);
  return { data: r.data, total: Number.isFinite(total) ? total : r.data.length };
}
