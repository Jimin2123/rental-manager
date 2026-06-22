import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ISocialProvider, SocialUserInfo } from './social-provider.interface';

@Injectable()
export class KakaoProvider implements ISocialProvider {
  constructor(private readonly config: ConfigService) {}

  async verify(accessToken: string): Promise<SocialUserInfo> {
    // 토큰 유효성 및 앱 소유권 검증
    const infoRes = await fetch('https://kapi.kakao.com/v1/user/access_token_info', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!infoRes.ok) throw new UnauthorizedException('유효하지 않은 Kakao 토큰입니다.');
    const info = (await infoRes.json()) as { id: number; expiresInMillis: number; appId: number };

    const kakaoAppId = this.config.get<string>('KAKAO_APP_ID');
    if (kakaoAppId && info.appId !== parseInt(kakaoAppId, 10)) {
      throw new UnauthorizedException('Invalid token audience');
    }

    // 프로필 정보 조회
    const profileRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileRes.ok) throw new UnauthorizedException('Kakao 토큰 검증에 실패했습니다.');
    const data = (await profileRes.json()) as { id: number; kakao_account?: { email?: string } };

    return {
      providerId: String(data.id),
      providerEmail: data.kakao_account?.email ?? null,
      providerData: {},
    };
  }
}
