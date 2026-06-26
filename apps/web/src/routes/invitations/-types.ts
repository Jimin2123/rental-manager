export type InvitationStatus = 'PENDING' | 'DECLINED' | 'EXPIRED';

export type InvitationTokenView = {
  id: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
  organization: { businessProfile: { name: string; businessRegistrationNo: string } };
};

export type MyInvitation = {
  id: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF';
  expiresAt: string;
  organization: { businessProfile: { name: string } };
  invitedBy: { name: string };
};

export type SentResult = {
  id: string;
  email: string;
  role: string;
  result: 'ACCEPTED' | 'DECLINED';
  acceptedAt: string | null;
  declinedAt: string | null;
};
