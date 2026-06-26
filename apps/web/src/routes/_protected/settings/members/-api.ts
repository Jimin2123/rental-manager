import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Member, PendingInvitation } from './-types';

export const memberKeys = {
  all: ['members'] as const,
  list: (orgId: string) => [...memberKeys.all, 'list', orgId] as const,
};

export const invitationKeys = {
  all: ['invitations'] as const,
  list: (orgId: string) => [...invitationKeys.all, 'list', orgId] as const,
};

export const fetchMembers = (orgId: string) => api.get<Member[]>(`/organizations/${orgId}/members`).then((r) => r.data);

export const fetchInvitations = (orgId: string) =>
  api.get<PendingInvitation[]>(`/organizations/${orgId}/invitations`).then((r) => r.data);

export function invalidateMembers(qc: QueryClient, orgId: string): void {
  void qc.invalidateQueries({ queryKey: memberKeys.list(orgId) });
}

export function invalidateInvitations(qc: QueryClient, orgId: string): void {
  void qc.invalidateQueries({ queryKey: invitationKeys.list(orgId) });
}
