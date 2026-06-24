import { create } from 'zustand';

export type OrganizationMemberRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF';

export type Organization = {
  id: string;
  name: string;
  businessRegistrationNo: string;
  role: OrganizationMemberRole;
};

type AuthState = {
  organizations: Organization[];
  currentOrganization: Organization | null;
  isInitialized: boolean;
  setAuth: (organizations: Organization[]) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  organizations: [],
  currentOrganization: null,
  isInitialized: false,
  setAuth: (organizations) =>
    set({
      organizations,
      currentOrganization: organizations[0] ?? null,
      isInitialized: true,
    }),
  clearAuth: () =>
    set({
      organizations: [],
      currentOrganization: null,
      isInitialized: true,
    }),
}));
