import { z } from 'zod';

const assignableRole = z.enum(['ADMIN', 'MANAGER', 'STAFF']);

export const editMemberSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요.'),
  department: z.string().optional(),
  position: z.string().optional(),
  memberPhone: z.string().optional(),
  role: assignableRole,
});
export type EditMemberValues = z.infer<typeof editMemberSchema>;
