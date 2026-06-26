export type OAuthProvider = 'GOOGLE' | 'KAKAO' | 'NAVER';

export type LinkedIdentity = { provider: OAuthProvider; providerEmail: string | null };

export const PROVIDERS: { key: OAuthProvider; label: string }[] = [
  { key: 'GOOGLE', label: 'Google' },
  { key: 'KAKAO', label: 'Kakao' },
  { key: 'NAVER', label: 'Naver' },
];
