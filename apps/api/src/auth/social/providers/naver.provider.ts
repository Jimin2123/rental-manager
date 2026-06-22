import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ISocialProvider, SocialUserInfo } from './social-provider.interface';

@Injectable()
export class NaverProvider implements ISocialProvider {
  async verify(accessToken: string): Promise<SocialUserInfo> {
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
}
