import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomerType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateCustomerDto } from './dto/create-customer.dto';
import type { UpdateCustomerDto } from './dto/update-customer.dto';
import type { QueryCustomerDto } from './dto/query-customer.dto';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateCustomerDto): Promise<{ id: string }> {
    const customer = await this.prisma.$transaction(async (tx) => {
      if (dto.type === CustomerType.INDIVIDUAL) {
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
      } else {
        const bp = dto.businessPartner!;
        const addr = await tx.address.create({ data: bp.businessProfile.address });
        const businessProfile = await tx.businessProfile.create({
          data: {
            name: bp.businessProfile.name,
            businessRegistrationNo: bp.businessProfile.businessRegistrationNo,
            representativeName: bp.businessProfile.representativeName,
            businessType: bp.businessProfile.businessType,
            businessItem: bp.businessProfile.businessItem,
            email: bp.businessProfile.email,
            phone: bp.businessProfile.phone,
            addressId: addr.id,
          },
        });
        const partner = await tx.businessPartner.create({
          data: { organizationId, businessProfileId: businessProfile.id, memo: bp.memo },
        });
        if (bp.roles?.length) {
          await tx.businessPartnerRole.createMany({
            data: bp.roles.map((type) => ({ organizationId, businessPartnerId: partner.id, type })),
          });
        }
        if (bp.contacts?.length) {
          await tx.businessPartnerContact.createMany({
            data: bp.contacts.map((c) => ({ ...c, organizationId, businessPartnerId: partner.id })),
          });
        }
        return tx.customer.create({
          data: { organizationId, type: CustomerType.BUSINESS, businessPartnerId: partner.id, memo: dto.memo },
        });
      }
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
