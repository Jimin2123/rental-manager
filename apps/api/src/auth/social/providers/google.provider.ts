import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ISocialProvider, SocialUserInfo } from './social-provider.interface';

@Injectable()
export class GoogleProvider implements ISocialProvider {
  async verify(accessToken: string): Promise<SocialUserInfo> {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new UnauthorizedException('Google 토큰 검증에 실패했습니다.');
    const data = (await res.json()) as { sub: string; email?: string; name?: string; picture?: string };
    return {
      providerId: data.sub,
      providerEmail: data.email ?? null,
      providerData: { name: data.name, picture: data.picture },
    };
  }
}
