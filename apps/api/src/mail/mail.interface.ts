export const MAIL_SERVICE = 'MAIL_SERVICE';

export interface IMailService {
  sendEmailVerification(to: string, verifyUrl: string): Promise<void>;
  sendPasswordReset(to: string, resetUrl: string): Promise<void>;
}
