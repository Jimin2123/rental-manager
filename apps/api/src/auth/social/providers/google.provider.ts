import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISocialProvider, SocialUserInfo } from './social-provider.interface';

@Injectable()
export class GoogleProvider implements ISocialProvider {
  constructor(private readonly config: ConfigService) {}

  async verify(accessToken: string): Promise<SocialUserInfo> {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`);
    if (!res.ok) throw new UnauthorizedException('유효하지 않은 Google 토큰입니다.');
    const data = (await res.json()) as {
      aud?: string;
      sub?: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (clientId && data.aud !== clientId) {
      throw new UnauthorizedException('Invalid token audience');
    }

    if (!data.sub) throw new UnauthorizedException('유효하지 않은 Google 토큰입니다.');

    return {
      providerId: data.sub,
      providerEmail: data.email ?? null,
      providerData: { name: data.name, picture: data.picture },
    };
  }

  getAuthorizationUrl(redirectUri: string, state: string): string {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string, redirectUri: string): Promise<SocialUserInfo> {
    const body = new URLSearchParams({
      code,
      client_id: this.config.get<string>('GOOGLE_CLIENT_ID') ?? '',
      client_secret: this.config.get<string>('GOOGLE_CLIENT_SECRET') ?? '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) throw new UnauthorizedException('Google 코드 교환에 실패했습니다.');
    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) throw new UnauthorizedException('Google 코드 교환에 실패했습니다.');
    return this.verify(data.access_token);
  }
}
