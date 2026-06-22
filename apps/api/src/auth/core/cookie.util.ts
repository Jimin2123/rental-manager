import { Response } from 'express';

const ACCESS_TOKEN = 'access_token';
const REFRESH_TOKEN = 'refresh_token';
const ACCESS_TTL_MS = 60 * 60 * 1000; // 1h
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d
const REMEMBER_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90d

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
  rememberMe = false,
): void {
  const isProd = process.env['NODE_ENV'] === 'production';
  const base = { httpOnly: true, secure: isProd, sameSite: 'strict' as const };

  res.cookie(ACCESS_TOKEN, tokens.accessToken, { ...base, path: '/', maxAge: ACCESS_TTL_MS });
  res.cookie(REFRESH_TOKEN, tokens.refreshToken, {
    ...base,
    path: '/auth',
    maxAge: rememberMe ? REMEMBER_TTL_MS : REFRESH_TTL_MS,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_TOKEN, { path: '/' });
  res.clearCookie(REFRESH_TOKEN, { path: '/auth' });
}
