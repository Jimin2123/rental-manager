import { z } from 'zod';

// 빈 문자열을 허용하는 선택 이메일 (거래처 스키마와 동일 idiom)
const optionalEmail = z.string().email('올바른 이메일을 입력해주세요.').optional().or(z.literal(''));

// 주소: 카카오 검색으로 채워지며 개인 고객은 선택 항목이다.
const addressSchema = z.object({
  zonecode: z.string().optional(),
  address: z.string().optional(),
  addressDetail: z.string().optional(),
  jibunAddress: z.string().optional(),
  roadAddress: z.string().optional(),
  buildingName: z.string().optional(),
});

// ─── 개인 고객 폼 (등록·수정 공용) ───────────────────────────────
// 등록(POST individualProfile)·수정(PATCH individualProfile) 모두 동일한 입력 형태라 하나로 둔다.
export const customerFormSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요.'),
  phone: z.string().optional(),
  email: optionalEmail,
  address: addressSchema,
  memo: z.string().optional(),
});
export type CustomerFormValues = z.infer<typeof customerFormSchema>;
