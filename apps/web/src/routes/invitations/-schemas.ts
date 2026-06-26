import { z } from 'zod';

export const signupAcceptSchema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
  memberName: z.string().min(1, '이름을 입력해주세요.'),
});
export type SignupAcceptValues = z.infer<typeof signupAcceptSchema>;
