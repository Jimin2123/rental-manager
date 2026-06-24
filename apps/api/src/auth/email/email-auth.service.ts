import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../core/jwt.strategy';
import { SessionService } from '../session/session.service';
import { TokenService } from '../session/token.service';
import type { SignupDto } from './dto/signup.dto';

const BCRYPT_ROUNDS = 12;
const TTL_30D_MS = 30 * 24 * 60 * 60 * 1000;
const TTL_90D_MS = 90 * 24 * 60 * 60 * 1000;

interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class EmailAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
  ) {}

  async register(email: string, password: string): Promise<void> {
    const existing = await this.prisma.account.findUnique({ where: { email } });
    if (existing) throw new ConflictException('이미 사용 중인 이메일입니다.');

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { type: 'PERSONAL' } });
      const account = await tx.account.create({ data: { userId: user.id, email, passwordHash } });
      await tx.passwordHistory.create({ data: { accountId: account.id, passwordHash } });
    });
  }

  async signup(dto: SignupDto, meta: SessionMeta): Promise<{ accessToken: string; refreshToken: string }> {
    const existing = await this.prisma.account.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('이미 사용 중인 이메일입니다.');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const { accountId, userId } = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { type: 'PERSONAL' } });
      const account = await tx.account.create({ data: { userId: user.id, email: dto.email, passwordHash } });
      await tx.passwordHistory.create({ data: { accountId: account.id, passwordHash } });

      const address = await tx.address.create({
        data: {
          zonecode: dto.zonecode,
          address: dto.address,
          addressDetail: dto.addressDetail,
          jibunAddress: dto.jibunAddress,
          roadAddress: dto.roadAddress,
          buildingName: dto.buildingName,
        },
      });
      const businessProfile = await tx.businessProfile.create({
        data: {
          name: dto.name,
          businessRegistrationNo: dto.businessRegistrationNo,
          representativeName: dto.representativeName,
          businessType: dto.businessType,
          businessItem: dto.businessItem,
          email: dto.orgEmail,
          phone: dto.orgPhone,
          addressId: address.id,
        },
      });
      const organization = await tx.organization.create({ data: { businessProfileId: businessProfile.id } });
      await tx.organizationMember.create({
        data: { userId: user.id, organizationId: organization.id, name: dto.memberName, role: 'OWNER', isActive: true },
      });

      return { accountId: account.id, userId: user.id };
    });

    return this.issueTokens(accountId, userId, dto.email, false, meta);
  }

  async validateCredentials(email: string, password: string) {
    const account = await this.prisma.account.findUnique({ where: { email } });
    if (!account || !account.passwordHash) throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    if (!account.isActive) throw new UnauthorizedException('비활성화된 계정입니다.');

    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');

    await this.prisma.account.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
    return account;
  }

  async issueTokens(
    accountId: string,
    userId: string,
    email: string,
    rememberMe: boolean,
    meta: SessionMeta,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = { sub: accountId, userId, email };
    const accessToken = this.tokenService.generateAccessToken(payload);
    const refreshToken = this.tokenService.generateRawRefreshToken();
    const expiresAt = new Date(Date.now() + (rememberMe ? TTL_90D_MS : TTL_30D_MS));
    await this.sessionService.create(accountId, refreshToken, expiresAt, meta);
    return { accessToken, refreshToken };
  }

  async refreshSession(
    rawToken: string,
    meta: SessionMeta,
  ): Promise<{ accessToken: string; refreshToken: string; rememberMe: boolean }> {
    const hash = this.tokenService.hashToken(rawToken);
    const session = await this.sessionService.findByHash(hash);

    if (!session) throw new UnauthorizedException('유효하지 않은 토큰입니다.');

    if (session.revokedAt) {
      await this.sessionService.revokeAll(session.accountId);
      throw new UnauthorizedException('토큰 재사용이 감지되었습니다. 모든 세션이 종료되었습니다.');
    }

    if (session.expiresAt < new Date()) throw new UnauthorizedException('만료된 토큰입니다.');

    const account = await this.prisma.account.findFirst({ where: { id: session.accountId } });
    if (!account || !account.isActive) throw new UnauthorizedException('비활성화된 계정입니다.');

    const newRaw = this.tokenService.generateRawRefreshToken();
    await this.sessionService.rotate(session.id, newRaw, session.accountId, session.expiresAt, meta);

    const accessToken = this.tokenService.generateAccessToken({
      sub: account.id,
      userId: account.userId,
      email: account.email,
    });
    const rememberMe = session.expiresAt.getTime() - Date.now() > TTL_30D_MS;
    return { accessToken, refreshToken: newRaw, rememberMe };
  }

  async switchOrg(
    accountId: string,
    userId: string,
    email: string,
    organizationId: string,
  ): Promise<{ accessToken: string }> {
    const member = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { role: true, isActive: true },
    });
    if (!member || !member.isActive) throw new ForbiddenException('해당 조직의 활성 멤버가 아닙니다.');

    const accessToken = this.tokenService.generateAccessToken({
      sub: accountId,
      userId,
      email,
      organizationId,
      role: member.role,
    });
    return { accessToken };
  }
}
