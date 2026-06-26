import { z } from 'zod';

// 빈 문자열을 undefined로 바꾼 뒤 정수(0 이상)로 강제하는 선택 숫자 필드
const optionalCount = z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().min(0).optional());

// ─── 제품 폼 (등록/수정 공용) ─────────────────────────────────────
export const productSchema = z.object({
  name: z.string().min(1, '제품명을 입력해주세요.'),
  manufacturer: z.string().optional(),
  modelName: z.string().optional(),
  category: z.string().optional(),
  memo: z.string().optional(),
});
export type ProductFormValues = z.infer<typeof productSchema>;

// ─── 자산 추가 폼 ─────────────────────────────────────────────────
export const addAssetSchema = z.object({
  initialStatus: z.enum(['AVAILABLE', 'INCOMING']),
  serialNumber: z.string().optional(),
  supplierId: z.string().optional(),
  purchaseDate: z.string().optional(),
  purchasePrice: optionalCount,
  memo: z.string().optional(),
});
export type AddAssetFormValues = z.infer<typeof addAssetSchema>;

// ─── 자산 수정 폼 (추가 폼에서 초기 상태만 제외) ──────────────────
export const editAssetSchema = addAssetSchema.omit({ initialStatus: true });
export type EditAssetValues = z.infer<typeof editAssetSchema>;

// ─── 미터 리딩 폼 ─────────────────────────────────────────────────
export const meterSchema = z.object({
  readingDate: z.string().min(1, '검침일을 입력해주세요.'),
  blackCount: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.coerce.number({ error: '흑백 누적값을 입력해주세요.' }).int().min(0, '0 이상의 값을 입력해주세요.'),
  ),
  colorCount: optionalCount,
  note: z.string().optional(),
});
export type MeterFormValues = z.infer<typeof meterSchema>;
