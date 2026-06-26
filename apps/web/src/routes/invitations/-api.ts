import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { InvitationTokenView, MyInvitation, SentResult } from './-types';
import type { SignupAcceptValues } from './-schemas';

export const inviteKeys = {
  mine: ['invitations', 'mine'] as const,
  sent: ['invitations', 'sent', 'recent'] as const,
};

export const fetchInvitationByToken = (token: string) =>
  api.get<InvitationTokenView>(`/invitations/${token}`).then((r) => r.data);
export const acceptByToken = (token: string) => api.post(`/invitations/${token}/accept`);
export const declineByToken = (token: string) => api.post(`/invitations/${token}/decline`);
export const signupAccept = (token: string, body: SignupAcceptValues) =>
  api.post(`/invitations/${token}/signup-accept`, body);

// 현재 로그인된 계정 정보(이미 멤버 안내 화면에서 계정 이메일 표시용)
export const fetchMe = () => api.get<{ userId: string; email: string | null }>('/auth/me').then((r) => r.data);

export const fetchMineInvitations = () => api.get<MyInvitation[]>('/invitations/mine').then((r) => r.data);
export const acceptMine = (id: string) => api.post(`/invitations/mine/${id}/accept`);
export const declineMine = (id: string) => api.post(`/invitations/mine/${id}/decline`);
export const fetchSentRecent = () => api.get<SentResult[]>('/invitations/sent/recent').then((r) => r.data);

export function invalidateMine(qc: QueryClient): void {
  void qc.invalidateQueries({ queryKey: inviteKeys.mine });
}
