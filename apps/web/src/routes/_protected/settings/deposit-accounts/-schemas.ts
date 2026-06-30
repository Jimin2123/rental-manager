import { z } from 'zod';

export const depositAccountSchema = z.object({
  bankName: z.string().min(1, '은행명을 입력해주세요.'),
  accountNumber: z.string().min(1, '계좌번호를 입력해주세요.'),
  accountHolder: z.string().min(1, '예금주를 입력해주세요.'),
  label: z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  memo: z.string().optional(),
});
export type DepositAccountValues = z.infer<typeof depositAccountSchema>;
