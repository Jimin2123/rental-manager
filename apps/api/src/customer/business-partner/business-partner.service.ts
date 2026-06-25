import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateBusinessPartnerDto, CreateContactDto } from './dto/create-business-partner.dto';
import type { UpdateBusinessPartnerDto, UpdateContactDto } from './dto/update-business-partner.dto';
import type { QueryBusinessPartnerDto } from './dto/query-business-partner.dto';

@Injectable()
export class BusinessPartnerService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateBusinessPartnerDto): Promise<{ id: string }> {
    const result = await this.prisma.$transaction(async (tx) => {
      const address = await tx.address.create({ data: dto.businessProfile.address });
      const businessProfile = await tx.businessProfile.create({
        data: {
          name: dto.businessProfile.name,
          businessRegistrationNo: dto.businessProfile.businessRegistrationNo,
          representativeName: dto.businessProfile.representativeName,
          businessType: dto.businessProfile.businessType,
          businessItem: dto.businessProfile.businessItem,
          email: dto.businessProfile.email,
          phone: dto.businessProfile.phone,
          addressId: address.id,
        },
      });
      const partner = await tx.businessPartner.create({
        data: { organizationId, businessProfileId: businessProfile.id, memo: dto.memo },
      });
      if (dto.roles.length) {
        await tx.businessPartnerRole.createMany({
          data: dto.roles.map((type) => ({ organizationId, businessPartnerId: partner.id, type })),
        });
      }
      if (dto.contacts?.length) {
        await tx.businessPartnerContact.createMany({
          data: dto.contacts.map((c) => ({ ...c, organizationId, businessPartnerId: partner.id })),
        });
      }
      return partner;
    });
    return { id: result.id };
  }

  async findAll(organizationId: string, query: QueryBusinessPartnerDto) {
    const { page = 1, limit = 20, role, isActive, q } = query;
    return this.prisma.businessPartner.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(isActive !== undefined && { isActive }),
        ...(role && { roles: { some: { type: role } } }),
        ...(q && { businessProfile: { name: { contains: q } } }),
      },
      include: {
        businessProfile: { select: { name: true, businessRegistrationNo: true } },
        roles: { select: { type: true } },
        _count: { select: { contacts: true } },
      },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const partner = await this.prisma.businessPartner.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include: {
        businessProfile: { include: { address: true } },
        roles: true,
        contacts: {
          where: { organizationId },
          orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });
    if (!partner || partner.deletedAt) throw new NotFoundException('거래처를 찾을 수 없습니다.');
    return partner;
  }

  async update(organizationId: string, id: string, dto: UpdateBusinessPartnerDto): Promise<void> {
    const partner = await this.prisma.businessPartner.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true, businessProfileId: true, deletedAt: true },
    });
    if (!partner || partner.deletedAt) throw new NotFoundException('거래처를 찾을 수 없습니다.');

    try {
      await this.prisma.$transaction(async (tx) => {
        if (dto.businessProfile) {
          const { address: addrDto, ...profileFields } = dto.businessProfile;
          const profileData = Object.fromEntries(Object.entries(profileFields).filter(([, v]) => v !== undefined));
          if (Object.keys(profileData).length) {
            await tx.businessProfile.update({ where: { id: partner.businessProfileId }, data: profileData });
          }
          if (addrDto) {
            const bp = await tx.businessProfile.findUnique({
              where: { id: partner.businessProfileId },
              select: { addressId: true },
            });
            const addrData = Object.fromEntries(Object.entries(addrDto).filter(([, v]) => v !== undefined));
            if (Object.keys(addrData).length) {
              await tx.address.update({ where: { id: bp!.addressId }, data: addrData });
            }
          }
        }
        if (dto.roles !== undefined) {
          const current = await tx.businessPartnerRole.findMany({
            where: { businessPartnerId: id, organizationId },
            select: { id: true, type: true },
          });
          const currentTypes = current.map((r) => r.type);
          const toDelete = current.filter((r) => !dto.roles!.includes(r.type));
          const toCreate = dto.roles.filter((type) => !currentTypes.includes(type));
          if (toDelete.length) {
            await tx.businessPartnerRole.deleteMany({ where: { id: { in: toDelete.map((r) => r.id) } } });
          }
          if (toCreate.length) {
            await tx.businessPartnerRole.createMany({
              data: toCreate.map((type) => ({ organizationId, businessPartnerId: id, type })),
            });
          }
        }
        const partnerData = Object.fromEntries(
          Object.entries({ memo: dto.memo, isActive: dto.isActive }).filter(([, v]) => v !== undefined),
        );
        if (Object.keys(partnerData).length) {
          await tx.businessPartner.update({ where: { id_organizationId: { id, organizationId } }, data: partnerData });
        }
      });
    } catch (e) {
      const cause = (e as { cause?: { code?: string; originalMessage?: string } })?.cause;
      if (cause?.code === 'P0001') {
        throw new ConflictException(cause.originalMessage ?? '업무 규칙 위반으로 수정할 수 없습니다.');
      }
      throw e;
    }
  }

  async softDelete(organizationId: string, id: string): Promise<void> {
    const partner = await this.prisma.businessPartner.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!partner || partner.deletedAt) throw new NotFoundException('거래처를 찾을 수 없습니다.');
    await this.prisma.businessPartner.update({
      where: { id_organizationId: { id, organizationId } },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  async addContact(organizationId: string, partnerId: string, dto: CreateContactDto): Promise<{ id: string }> {
    const partner = await this.prisma.businessPartner.findUnique({
      where: { id_organizationId: { id: partnerId, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!partner || partner.deletedAt) throw new NotFoundException('거래처를 찾을 수 없습니다.');
    const contact = await this.prisma.businessPartnerContact.create({
      data: { organizationId, businessPartnerId: partnerId, ...dto },
    });
    return { id: contact.id };
  }

  async updateContact(
    organizationId: string,
    partnerId: string,
    contactId: string,
    dto: UpdateContactDto,
  ): Promise<void> {
    const contact = await this.prisma.businessPartnerContact.findUnique({
      where: { id_organizationId: { id: contactId, organizationId } },
    });
    if (!contact || contact.businessPartnerId !== partnerId) throw new NotFoundException('담당자를 찾을 수 없습니다.');
    const data = Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));
    if (Object.keys(data).length) {
      await this.prisma.businessPartnerContact.update({
        where: { id_organizationId: { id: contactId, organizationId } },
        data,
      });
    }
  }

  async removeContact(organizationId: string, partnerId: string, contactId: string): Promise<void> {
    const contact = await this.prisma.businessPartnerContact.findUnique({
      where: { id_organizationId: { id: contactId, organizationId } },
    });
    if (!contact || contact.businessPartnerId !== partnerId) throw new NotFoundException('담당자를 찾을 수 없습니다.');
    try {
      await this.prisma.businessPartnerContact.delete({
        where: { id_organizationId: { id: contactId, organizationId } },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException('해당 담당자를 참조하는 배정이 있습니다. 먼저 배정을 삭제해주세요.');
      }
      throw e;
    }
  }
}
