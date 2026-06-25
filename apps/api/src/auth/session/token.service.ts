import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import { JwtPayload } from '../core/jwt.strategy';

export interface MergeTokenPayload {
  type: 'account_merge';
  sourceAccountId: string;
  targetAccountId: string;
  provider: string;
}

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
      expiresIn: this.config.get('JWT_EXPIRES_IN', '1h'),
    };
    return this.jwt.sign(payload, options);
  }

  generateMergeToken(payload: MergeTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
      expiresIn: '5m',
    });
  }

  verifyMergeToken(token: string): MergeTokenPayload {
    try {
      return this.jwt.verify<MergeTokenPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('유효하지 않거나 만료된 병합 토큰입니다.');
    }
  }
}
