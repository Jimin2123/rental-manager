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
}
