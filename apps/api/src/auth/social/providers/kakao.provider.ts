import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ISocialProvider, SocialUserInfo } from './social-provider.interface';

@Injectable()
export class KakaoProvider implements ISocialProvider {
  async verify(accessToken: string): Promise<SocialUserInfo> {
    const res = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new UnauthorizedException('Kakao 토큰 검증에 실패했습니다.');
    const data = (await res.json()) as { id: number; kakao_account?: { email?: string } };
    return {
      providerId: String(data.id),
      providerEmail: data.kakao_account?.email ?? null,
      providerData: {},
    };
  }
}
