import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from './token.service';
import { SessionService } from './session.service';

const makeRefreshToken = (overrides = {}) => ({
  id: 'rt-1',
  accountId: 'acc-1',
  tokenHash: 'hash:raw',
  revokedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
  userAgent: null,
  ipAddress: null,
  createdAt: new Date(),
  ...overrides,
});

describe('SessionService', () => {
  let service: SessionService;
  let rt: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock; findMany: jest.Mock };
  let $transaction: jest.Mock;

  beforeEach(async () => {
    rt = { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn(), findMany: jest.fn() };
    $transaction = jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        { provide: PrismaService, useValue: { refreshToken: rt, $transaction } },
        { provide: TokenService, useValue: { hashToken: (raw: string) => `hash:${raw}` } },
      ],
    }).compile();
    service = module.get(SessionService);
  });

  describe('create', () => {
    it('stores the token by hash, not raw value', async () => {
      rt.create.mockResolvedValue(makeRefreshToken());
      await service.create('acc-1', 'my-raw', new Date(), {});
      expect(rt.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tokenHash: 'hash:my-raw', accountId: 'acc-1' }) }),
      );
    });
  });

  describe('findByHash', () => {
    it('returns null when not found', async () => {
      rt.findUnique.mockResolvedValue(null);
      expect(await service.findByHash('h')).toBeNull();
    });

    it('returns the record regardless of revokedAt (used for reuse detection)', async () => {
      const record = makeRefreshToken({ revokedAt: new Date() });
      rt.findUnique.mockResolvedValue(record);
      expect(await service.findByHash('h')).toEqual(record);
    });
  });

  describe('findValidByHash', () => {
    it('returns null when not found', async () => {
      rt.findUnique.mockResolvedValue(null);
      expect(await service.findValidByHash('h')).toBeNull();
    });

    it('returns null when revokedAt is set', async () => {
      rt.findUnique.mockResolvedValue(makeRefreshToken({ revokedAt: new Date() }));
      expect(await service.findValidByHash('h')).toBeNull();
    });

    it('returns null when expired', async () => {
      rt.findUnique.mockResolvedValue(makeRefreshToken({ expiresAt: new Date(Date.now() - 1000) }));
      expect(await service.findValidByHash('h')).toBeNull();
    });

    it('returns the record when valid', async () => {
      const record = makeRefreshToken();
      rt.findUnique.mockResolvedValue(record);
      expect(await service.findValidByHash('h')).toEqual(record);
    });
  });

  describe('revokeAll', () => {
    it('sets revokedAt on all non-revoked tokens for the account', async () => {
      rt.updateMany.mockResolvedValue({ count: 3 });
      await service.revokeAll('acc-1');
      expect(rt.updateMany).toHaveBeenCalledWith({
        where: { accountId: 'acc-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('revokeById', () => {
    it('sets revokedAt scoped to the account', async () => {
      rt.update.mockResolvedValue({});
      await service.revokeById('rt-1', 'acc-1');
      expect(rt.update).toHaveBeenCalledWith({
        where: { id: 'rt-1', accountId: 'acc-1' },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  describe('listActive', () => {
    it('queries with revokedAt null and expiresAt in the future', async () => {
      rt.findMany.mockResolvedValue([]);
      await service.listActive('acc-1');
      expect(rt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountId: 'acc-1',
            revokedAt: null,
            expiresAt: { gt: expect.any(Date) },
          }),
        }),
      );
    });
  });
});
