import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CustomerType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';
import type { QueryCustomerDto } from './dto/query-customer.dto';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateCustomerDto): Promise<{ id: string }> {
    if (dto.type === CustomerType.INDIVIDUAL) {
      const customer = await this.prisma.$transaction(async (tx) => {
        let addressId: string | undefined;
        if (dto.individualProfile!.address) {
          const addr = await tx.address.create({ data: dto.individualProfile!.address });
          addressId = addr.id;
        }
        const profile = await tx.individualProfile.create({
          data: {
            name: dto.individualProfile!.name,
            phone: dto.individualProfile!.phone,
            email: dto.individualProfile!.email,
            addressId,
          },
        });
        return tx.customer.create({
          data: { organizationId, type: CustomerType.INDIVIDUAL, individualProfileId: profile.id, memo: dto.memo },
        });
      });
      return { id: customer.id };
    }

    // 법인 고객: 기존 거래처를 연결한다(새 거래처를 만들지 않음).
    const businessPartnerId = dto.businessPartnerId!;
    const partner = await this.prisma.businessPartner.findUnique({
      where: { id_organizationId: { id: businessPartnerId, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!partner || partner.deletedAt) throw new NotFoundException('거래처를 찾을 수 없습니다.');

    const existing = await this.prisma.customer.findFirst({
      where: { organizationId, businessPartnerId, deletedAt: null },
      select: { id: true },
    });
    if (existing) throw new ConflictException('이미 고객으로 등록된 거래처입니다.');

    const customer = await this.prisma.customer.create({
      data: { organizationId, type: CustomerType.BUSINESS, businessPartnerId, memo: dto.memo },
    });
    return { id: customer.id };
  }

  async findAll(organizationId: string, query: QueryCustomerDto) {
    const { page = 1, limit = 20, type, isActive, q } = query;
    return this.prisma.customer.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(type && { type }),
        ...(isActive !== undefined && { isActive }),
        ...(q && {
          OR: [
            { individualProfile: { name: { contains: q } } },
            { businessPartner: { businessProfile: { name: { contains: q } } } },
          ],
        }),
      },
      include: {
        individualProfile: { select: { name: true, phone: true, email: true } },
        businessPartner: {
          include: {
            businessProfile: { select: { name: true, businessRegistrationNo: true } },
            roles: { select: { type: true } },
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include: {
        individualProfile: { include: { address: true } },
        businessPartner: {
          include: {
            businessProfile: { include: { address: true } },
            roles: true,
            contacts: { where: { organizationId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
          },
        },
      },
    });
    if (!customer || customer.deletedAt) throw new NotFoundException('고객을 찾을 수 없습니다.');
    return customer;
  }

  async update(organizationId: string, id: string, dto: UpdateCustomerDto): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true, type: true, individualProfileId: true, deletedAt: true },
    });
    if (!customer || customer.deletedAt) throw new NotFoundException('고객을 찾을 수 없습니다.');

    await this.prisma.$transaction(async (tx) => {
      const customerData = Object.fromEntries(
        Object.entries({ memo: dto.memo, isActive: dto.isActive }).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(customerData).length) {
        await tx.customer.update({ where: { id_organizationId: { id, organizationId } }, data: customerData });
      }
      if (dto.individualProfile && customer.type === CustomerType.INDIVIDUAL && customer.individualProfileId) {
        const { address: addrDto, ...profileFields } = dto.individualProfile;
        const profileData = Object.fromEntries(Object.entries(profileFields).filter(([, v]) => v !== undefined));
        if (Object.keys(profileData).length) {
          await tx.individualProfile.update({ where: { id: customer.individualProfileId }, data: profileData });
        }
        if (addrDto) {
          const profile = await tx.individualProfile.findUnique({
            where: { id: customer.individualProfileId },
            select: { addressId: true },
          });
          const addrData = Object.fromEntries(Object.entries(addrDto).filter(([, v]) => v !== undefined));
          if (Object.keys(addrData).length) {
            if (profile?.addressId) {
              await tx.address.update({ where: { id: profile.addressId }, data: addrData });
            }
          }
        }
      }
    });
  }

  async softDelete(organizationId: string, id: string): Promise<void> {
    const customer = await this.prisma.customer.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!customer || customer.deletedAt) throw new NotFoundException('고객을 찾을 수 없습니다.');
    await this.prisma.customer.update({
      where: { id_organizationId: { id, organizationId } },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
