export type CustomerType = 'INDIVIDUAL' | 'BUSINESS';

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  INDIVIDUAL: '개인',
  BUSINESS: '법인',
};

export type Address = {
  zonecode: string;
  address: string;
  addressDetail: string | null;
  jibunAddress: string | null;
  roadAddress: string | null;
  buildingName: string | null;
};

// 목록 항목 — 백엔드 customer.findAll include와 1:1.
// 개인이면 individualProfile, 법인이면 businessPartner 중 하나만 채워진다.
export type CustomerListItem = {
  id: string;
  type: CustomerType;
  isActive: boolean;
  createdAt: string;
  individualProfile: { name: string; phone: string | null; email: string | null } | null;
  businessPartner: {
    businessProfile: { name: string; businessRegistrationNo: string };
    roles: { type: 'SALES' | 'PURCHASE' }[];
  } | null;
};

// 상세 — 백엔드 customer.findOne include와 1:1.
export type CustomerDetail = {
  id: string;
  type: CustomerType;
  isActive: boolean;
  memo: string | null;
  createdAt: string;
  individualProfile: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: Address | null;
  } | null;
  businessPartner: {
    id: string;
    businessProfile: {
      name: string;
      businessRegistrationNo: string;
      representativeName: string;
      businessType: string | null;
      businessItem: string | null;
      email: string | null;
      phone: string | null;
      address: Address | null;
    };
    roles: { id: string; type: 'SALES' | 'PURCHASE' }[];
  } | null;
};

// 담당자 배정 — 백엔드 assignment.list include와 1:1.
// endedAt이 null이면 현재 배정, 값이 있으면 종료(이력)된 배정이다.
export type Assignment = {
  id: string;
  role: string | null;
  isPrimary: boolean;
  startedAt: string;
  endedAt: string | null;
  memo: string | null;
  organizationMember: { id: string; name: string; role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF' };
  customerContact: { id: string; name: string; department: string | null } | null;
};
