import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;
  let jwtSign: jest.Mock;

  beforeEach(async () => {
    jwtSign = jest.fn().mockReturnValue('signed-jwt');
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: { sign: jwtSign } },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('test-secret'),
            get: jest.fn().mockReturnValue('1h'),
          },
        },
      ],
    }).compile();
    service = module.get(TokenService);
  });

  it('hashToken returns a 64-char SHA-256 hex string', () => {
    expect(service.hashToken('any-token')).toHaveLength(64);
    expect(service.hashToken('any-token')).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hashToken is deterministic', () => {
    expect(service.hashToken('abc')).toBe(service.hashToken('abc'));
  });

  it('hashToken produces different output for different inputs', () => {
    expect(service.hashToken('abc')).not.toBe(service.hashToken('def'));
  });

  it('generateRawRefreshToken returns a 64-char hex string', () => {
    const raw = service.generateRawRefreshToken();
    expect(raw).toHaveLength(64);
    expect(raw).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generateRawRefreshToken produces unique values on each call', () => {
    expect(service.generateRawRefreshToken()).not.toBe(service.generateRawRefreshToken());
  });

  it('generateAccessToken calls JwtService.sign with payload and secret', () => {
    service.generateAccessToken({ sub: 'acc-1', userId: 'u-1', email: 'a@b.com' });
    expect(jwtSign).toHaveBeenCalledWith(
      { sub: 'acc-1', userId: 'u-1', email: 'a@b.com' },
      expect.objectContaining({ secret: 'test-secret', expiresIn: '1h' }),
    );
  });
});
