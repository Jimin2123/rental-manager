import { type AxiosError } from 'axios';
import { toast } from 'sonner';

/**
 * API 에러를 토스트로 표시한다. HTTP status별 메시지를 byStatus로 지정하고,
 * 매칭되는 status가 없으면 fallback을 쓴다.
 */
export function toastApiError(err: unknown, fallback: string, byStatus?: Record<number, string>): void {
  const status = (err as AxiosError).response?.status;
  toast.error((status != null && byStatus?.[status]) || fallback);
}
