import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateOrganizationDto } from './dto/create-organization.dto';
import type { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateOrganizationDto): Promise<{ organizationId: string }> {
    const org = await this.prisma.$transaction(async (tx) => {
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
      const organization = await tx.organization.create({
        data: { businessProfileId: businessProfile.id },
      });
      await tx.organizationMember.create({
        data: {
          userId,
          organizationId: organization.id,
          name: dto.memberName,
          role: 'OWNER',
          isActive: true,
        },
      });
      return organization;
    });
    return { organizationId: org.id };
  }

  async findMyOrganizations(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId, isActive: true },
      include: { organization: { include: { businessProfile: true } } },
    });
    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.businessProfile.name,
      businessRegistrationNo: m.organization.businessProfile.businessRegistrationNo,
      role: m.role,
    }));
  }

  async findById(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { businessProfile: { include: { address: true } } },
    });
    if (!org) throw new NotFoundException('조직을 찾을 수 없습니다.');
    return org;
  }

  async update(organizationId: string, dto: UpdateOrganizationDto): Promise<void> {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('조직을 찾을 수 없습니다.');

    const { memo, ...profileFields } = dto;
    const profileData = Object.fromEntries(
      Object.entries({
        name: profileFields.name,
        businessType: profileFields.businessType,
        businessItem: profileFields.businessItem,
        email: profileFields.orgEmail,
        phone: profileFields.orgPhone,
      }).filter(([, v]) => v !== undefined),
    );

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(profileData).length) {
        await tx.businessProfile.update({ where: { id: org.businessProfileId }, data: profileData });
      }
      if (memo !== undefined) {
        await tx.organization.update({ where: { id: organizationId }, data: { memo } });
      }
    });
  }
}
