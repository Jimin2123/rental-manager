import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISocialProvider, SocialUserInfo } from './social-provider.interface';

@Injectable()
export class NaverProvider implements ISocialProvider {
  constructor(private readonly config: ConfigService) {}

  private getRequiredConfig(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) throw new Error(`${key} is not configured`);
    return value;
  }

  async verify(accessToken: string): Promise<SocialUserInfo> {
    // Naver 액세스 토큰은 OAuth 인가 시점에 앱(클라이언트 ID) 단위로 발급되므로
    // 200 응답 자체가 해당 앱에 대한 토큰임을 암묵적으로 검증한다.
    const res = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new UnauthorizedException('Naver 토큰 검증에 실패했습니다.');
    const data = (await res.json()) as { response: { id: string; email?: string } };
    return {
      providerId: data.response.id,
      providerEmail: data.response.email ?? null,
      providerData: {},
    };
  }

  getAuthorizationUrl(redirectUri: string, state: string): string {
    const clientId = this.getRequiredConfig('NAVER_CLIENT_ID');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
    });
    return `https://nid.naver.com/oauth2.0/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string, state?: string): Promise<SocialUserInfo> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.getRequiredConfig('NAVER_CLIENT_ID'),
      client_secret: this.getRequiredConfig('NAVER_CLIENT_SECRET'),
      redirect_uri: redirectUri,
      code,
      ...(state ? { state } : {}),
    });
    const res = await fetch('https://nid.naver.com/oauth2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) throw new UnauthorizedException('Naver 코드 교환에 실패했습니다.');
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new UnauthorizedException('Naver 코드 교환에 실패했습니다.');
    return this.verify(data.access_token);
  }
}
