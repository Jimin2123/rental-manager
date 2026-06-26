export interface SocialUserInfo {
  providerId: string;
  providerEmail: string | null;
  providerData: Record<string, string | undefined>;
}

export interface ISocialProvider {
  verify(accessToken: string): Promise<SocialUserInfo>;
  getAuthorizationUrl(redirectUri: string, state: string): string;
  exchangeCode(code: string, redirectUri: string, state?: string): Promise<SocialUserInfo>;
}
