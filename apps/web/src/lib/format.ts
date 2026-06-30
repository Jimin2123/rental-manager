// 표시용 포맷터 — 금액(원)·날짜. 도메인 화면 공용.

/** 원화 금액 표시. null이면 '-'. 예: 50000 → "50,000원" */
export const won = (n: number | null): string => (n == null ? '-' : `${n.toLocaleString('ko-KR')}원`);

/** 날짜 표시(YYYY.MM.DD, ko-KR). null이면 '-'. ISO 문자열을 받는다. */
export const date = (s: string | null): string => (s ? new Date(s).toLocaleDateString('ko-KR') : '-');

/** 사업자등록번호 자동 포맷. 예: "1268204338" → "126-82-04338" */
export const formatBrn = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
};

/**
 * 한국 전화번호 자동 포맷.
 * - 02 지역번호: 9자리 → 02-XXX-XXXX, 10자리 → 02-XXXX-XXXX
 * - 그 외: 10자리 → 0XX-XXX-XXXX, 11자리 → 0XX-XXXX-XXXX
 */
export const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};
