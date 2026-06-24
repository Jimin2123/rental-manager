export interface KakaoAddressResult {
  zonecode: string;
  address: string;
  addressType: 'R' | 'J';
  jibunAddress: string;
  roadAddress: string;
  buildingName: string;
}

export function openKakaoAddressSearch(onComplete: (result: KakaoAddressResult) => void) {
  new window.daum.Postcode({ oncomplete: onComplete }).open();
}
