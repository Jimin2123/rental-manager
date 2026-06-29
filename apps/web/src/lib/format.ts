// 표시용 포맷터 — 금액(원)·날짜. 도메인 화면 공용.

/** 원화 금액 표시. null이면 '-'. 예: 50000 → "50,000원" */
export const won = (n: number | null): string => (n == null ? '-' : `${n.toLocaleString('ko-KR')}원`);

/** 날짜 표시(YYYY.MM.DD, ko-KR). null이면 '-'. ISO 문자열을 받는다. */
export const date = (s: string | null): string => (s ? new Date(s).toLocaleDateString('ko-KR') : '-');
