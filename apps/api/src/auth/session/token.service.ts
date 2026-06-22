import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { JwtPayload } from '../core/jwt.strategy';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  generateRawRefreshToken(): string {
    return randomBytes(32).toString('hex');
  }

  generateAccessToken(payload: JwtPayload): string {
    const options: JwtSignOptions = {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: this.config.get('JWT_EXPIRES_IN', '1h') as JwtSignOptions['expiresIn'],
    };
    return this.jwt.sign(payload, options);
  }
}
