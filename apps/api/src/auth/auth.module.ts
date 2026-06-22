import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MailModule } from '../mail/mail.module';
import { JwtStrategy } from './core/jwt.strategy';
import { EmailAuthController } from './email/email-auth.controller';
import { EmailAuthService } from './email/email-auth.service';
import { PasswordController } from './password/password.controller';
import { PasswordService } from './password/password.service';
import { SessionService } from './session/session.service';
import { TokenService } from './session/token.service';
import { GoogleProvider } from './social/providers/google.provider';
import { KakaoProvider } from './social/providers/kakao.provider';
import { NaverProvider } from './social/providers/naver.provider';
import { SocialAuthController } from './social/social-auth.controller';
import { SocialAuthService } from './social/social-auth.service';
import { DbVerificationTokenStore } from './verification/token-store/db-verification-token-store.service';
import { VERIFICATION_TOKEN_STORE } from './verification/token-store/verification-token-store.interface';
import { VerificationController } from './verification/verification.controller';
import { VerificationService } from './verification/verification.service';

@Module({
  imports: [PassportModule, JwtModule.register({}), MailModule],
  controllers: [EmailAuthController, VerificationController, PasswordController, SocialAuthController],
  providers: [
    JwtStrategy,
    TokenService,
    SessionService,
    EmailAuthService,
    VerificationService,
    PasswordService,
    { provide: VERIFICATION_TOKEN_STORE, useClass: DbVerificationTokenStore },
    GoogleProvider,
    KakaoProvider,
    NaverProvider,
    SocialAuthService,
  ],
  exports: [JwtModule, TokenService, SessionService],
})
export class AuthModule {}
