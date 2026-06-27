import type { CustomerFormValues } from '../-schemas';

// 폼 주소 → API 주소 페이로드.
// 우편번호+기본주소가 없으면(검색 안 함) 주소를 보내지 않는다(개인 주소는 선택).
export function toAddressPayload(address: CustomerFormValues['address']) {
  if (!address.zonecode || !address.address) return undefined;
  return {
    zonecode: address.zonecode,
    address: address.address,
    addressDetail: address.addressDetail || undefined,
    jibunAddress: address.jibunAddress || undefined,
    roadAddress: address.roadAddress || undefined,
    buildingName: address.buildingName || undefined,
  };
}
