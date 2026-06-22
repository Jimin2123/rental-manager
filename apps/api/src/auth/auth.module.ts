import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './core/jwt.strategy';
import { EmailAuthController } from './email/email-auth.controller';
import { EmailAuthService } from './email/email-auth.service';
import { SessionService } from './session/session.service';
import { TokenService } from './session/token.service';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [EmailAuthController],
  providers: [JwtStrategy, TokenService, SessionService, EmailAuthService],
  exports: [JwtModule, TokenService, SessionService],
})
export class AuthModule {}
