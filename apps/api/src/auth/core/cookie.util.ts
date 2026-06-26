import { Response } from 'express';

const ACCESS_TOKEN = 'access_token';
const REFRESH_TOKEN = 'refresh_token';
// 클라이언트가 읽을 수 있는 세션 존재 힌트(httpOnly 아님).
// 부트스트랩이 이 마커로 /organizations/me 호출 여부를 결정한다.
// 소셜 OAuth처럼 서버 쿠키로만 세션을 확립하는 경로도 균일하게 커버한다.
const SESSION_MARKER = 'rm_has_session';
const ACCESS_TTL_MS = 60 * 60 * 1000; // 1h
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d
const REMEMBER_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90d

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  rememberMe = false,
): void {
  const isProd = process.env['NODE_ENV'] === 'production';
  const base = { httpOnly: true, secure: isProd, sameSite: 'lax' as const };
  const sessionTtl = rememberMe ? REMEMBER_TTL_MS : REFRESH_TTL_MS;

  res.cookie(ACCESS_TOKEN, tokens.accessToken, { ...base, path: '/', maxAge: ACCESS_TTL_MS });
  res.cookie(REFRESH_TOKEN, tokens.refreshToken, { ...base, path: '/auth', maxAge: sessionTtl });
  res.cookie(SESSION_MARKER, '1', {
    httpOnly: false,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: sessionTtl,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN, { path: '/' });
  res.clearCookie(REFRESH_TOKEN, { path: '/auth' });
  res.clearCookie(SESSION_MARKER, { path: '/' });
}

export function setAccessTokenCookie(res: Response, accessToken: string): void {
  const isProd = process.env['NODE_ENV'] === 'production';
  res.cookie(ACCESS_TOKEN, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: ACCESS_TTL_MS,
  });
}
