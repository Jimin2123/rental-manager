import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ISocialProvider, SocialUserInfo } from './social-provider.interface';

@Injectable()
export class NaverProvider implements ISocialProvider {
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
}
