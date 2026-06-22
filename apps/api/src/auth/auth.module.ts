import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './core/jwt.strategy';
import { TokenService } from './session/token.service';
import { SessionService } from './session/session.service';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  providers: [JwtStrategy, TokenService, SessionService],
  exports: [JwtModule, TokenService, SessionService],
})
export class AuthModule {}
