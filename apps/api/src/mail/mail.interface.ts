export const MAIL_SERVICE = 'MAIL_SERVICE';

export interface IMailService {
  sendEmailVerification(to: string, verifyUrl: string): Promise<void>;
  sendPasswordReset(to: string, resetUrl: string): Promise<void>;
  sendOrganizationInvite(to: string, inviteUrl: string, organizationName: string): Promise<void>;
}
