import { z } from 'zod';

// 빈 문자열을 허용하는 선택 이메일 (3곳에서 반복되던 idiom)
const optionalEmail = z.string().email('올바른 이메일을 입력해주세요.').optional().or(z.literal(''));

// ─── 담당자 폼 (생성·상세 추가/수정 공용) ─────────────────────────
export const contactSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요.'),
  department: z.string().optional(),
  position: z.string().optional(),
  role: z.string().optional(),
  phone: z.string().optional(),
  email: optionalEmail,
  isPrimary: z.boolean().optional(),
  memo: z.string().optional(),
});
export type ContactFormValues = z.infer<typeof contactSchema>;

// 사업자등록번호: 하이픈 유무 모두 허용
const businessRegistrationNo = z
  .string()
  .refine(
    (v) => /^\d{3}-\d{2}-\d{5}$/.test(v) || /^\d{10}$/.test(v),
    '올바른 사업자등록번호를 입력해주세요. (예: 123-45-67890)',
  );

const rolesField = z.array(z.enum(['SALES', 'PURCHASE'])).min(1, '역할을 최소 1개 선택해주세요.');

// ─── 거래처 생성 폼 (사업자번호 필수, 주소 필수, 담당자 인라인) ───
export const partnerCreateSchema = z.object({
  roles: rolesField,
  businessProfile: z.object({
    name: z.string().min(1, '상호명을 입력해주세요.'),
    businessRegistrationNo,
    representativeName: z.string().min(1, '대표자명을 입력해주세요.'),
    businessType: z.string().optional(),
    businessItem: z.string().optional(),
    email: optionalEmail,
    phone: z.string().optional(),
    address: z.object({
      zonecode: z.string().min(1, '주소를 검색해주세요.'),
      address: z.string().min(1, '주소를 검색해주세요.'),
      addressDetail: z.string().optional(),
      jibunAddress: z.string().optional(),
      roadAddress: z.string().optional(),
      buildingName: z.string().optional(),
    }),
  }),
  contacts: z.array(contactSchema).optional(),
  memo: z.string().optional(),
});
export type PartnerCreateValues = z.infer<typeof partnerCreateSchema>;

// ─── 거래처 수정 폼 (사업자번호 수정 불가, 주소 선택, 담당자는 별도 관리) ───
export const partnerEditSchema = z.object({
  roles: rolesField,
  memo: z.string().optional(),
  businessProfile: z.object({
    name: z.string().min(1, '상호명을 입력해주세요.'),
    representativeName: z.string().min(1, '대표자명을 입력해주세요.'),
    businessType: z.string().optional(),
    businessItem: z.string().optional(),
    email: optionalEmail,
    phone: z.string().optional(),
    address: z.object({
      zonecode: z.string().optional(),
      address: z.string().optional(),
      addressDetail: z.string().optional(),
    }),
  }),
});
export type PartnerEditValues = z.infer<typeof partnerEditSchema>;
