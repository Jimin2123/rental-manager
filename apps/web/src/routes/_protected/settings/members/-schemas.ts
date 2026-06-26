import { z } from 'zod';

const assignableRole = z.enum(['ADMIN', 'MANAGER', 'STAFF']);

export const addMemberSchema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요.'),
  name: z.string().min(1, '이름을 입력해주세요.'),
  department: z.string().optional(),
  position: z.string().optional(),
  role: assignableRole,
});
export type AddMemberValues = z.infer<typeof addMemberSchema>;

export const editMemberSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요.'),
  department: z.string().optional(),
  position: z.string().optional(),
  memberPhone: z.string().optional(),
  role: assignableRole,
});
export type EditMemberValues = z.infer<typeof editMemberSchema>;
