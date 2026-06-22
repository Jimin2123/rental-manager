import { VerificationTokenType } from '@prisma/client';

export const VERIFICATION_TOKEN_STORE = 'VERIFICATION_TOKEN_STORE';

export interface IVerificationTokenStore {
  save(params: { token: string; type: VerificationTokenType; accountId: string; expiresAt: Date }): Promise<void>;
  findValid(token: string, type: VerificationTokenType): Promise<{ id: string; accountId: string } | null>;
  markUsed(id: string): Promise<void>;
}
