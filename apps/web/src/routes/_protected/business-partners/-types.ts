export type RoleType = 'SALES' | 'PURCHASE';

export const ROLE_LABEL: Record<RoleType, string> = {
  SALES: '매출',
  PURCHASE: '매입',
};

export type BusinessPartnerListItem = {
  id: string;
  isActive: boolean;
  createdAt: string;
  businessProfile: { name: string; businessRegistrationNo: string };
  roles: { type: RoleType }[];
  _count: { contacts: number };
};

export type Contact = {
  id: string;
  name: string;
  department: string | null;
  position: string | null;
  role: string | null;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  memo: string | null;
};

export type BusinessPartnerDetail = {
  id: string;
  isActive: boolean;
  memo: string | null;
  createdAt: string;
  businessProfile: {
    id: string;
    name: string;
    businessRegistrationNo: string;
    representativeName: string;
    businessType: string | null;
    businessItem: string | null;
    email: string | null;
    phone: string | null;
    address: {
      zonecode: string;
      address: string;
      addressDetail: string | null;
      jibunAddress: string | null;
      roadAddress: string | null;
      buildingName: string | null;
    };
  };
  roles: { id: string; type: RoleType }[];
  contacts: Contact[];
};
