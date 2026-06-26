export type MemberRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF';

export const ROLE_LABEL: Record<MemberRole, string> = {
  OWNER: '사업자',
  ADMIN: '관리자',
  MANAGER: '담당자',
  STAFF: '직원',
};

// OWNER는 조직 생성자 1명뿐이라 부여 대상에서 제외
export const ASSIGNABLE_ROLES: Exclude<MemberRole, 'OWNER'>[] = ['ADMIN', 'MANAGER', 'STAFF'];

export type Member = {
  id: string;
  userId: string;
  role: MemberRole;
  name: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
};

export type PendingInvitation = {
  id: string;
  email: string;
  role: MemberRole;
  expiresAt: string;
  createdAt: string;
  invitedBy: { name: string };
};
