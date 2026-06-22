# Customer Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customer(고객), BusinessPartner(거래처), CustomerAssignment(담당자 배정) CRUD API를 구현한다.

**Architecture:** `CustomerModule` 하나로 묶고 내부를 `business-partner/`, `customer/`, `assignment/` 세 서브 디렉터리로 분리한다. 모든 엔드포인트에 `OrganizationGuard`를 적용해 tenant 격리하며, 삭제 작업만 `@Roles('OWNER', 'ADMIN')`으로 제한한다.

**Tech Stack:** NestJS 11, Prisma 7 (`@prisma/adapter-pg`), class-validator 0.15, class-transformer 0.5

## Global Constraints

- 모든 파일은 `apps/api/src/` 기준 경로 사용
- 들여쓰기: 2칸 space, single quote, trailing comma (prettier.config.mjs 기준)
- 테스트 명령: `pnpm test` (from `apps/api/`)
- 커밋 메시지에 `Co-Authored-By` 트레일러 추가 금지
- `PrismaModule`은 `@Global()` — 별도 import 불필요
- `OrganizationModule`이 `OrganizationGuard`를 export 함 — CustomerModule에서 import
- 소프트 삭제: `deletedAt = new Date()` + `isActive = false` 설정
- BusinessPartner/Customer 생성 시 반드시 `$transaction` 사용
- `isPrimary: true` 배정 시 기존 주담당자 자동 해제

---

## File Map

```
src/customer/
├── customer.module.ts                              (T1에서 생성, T2·T3에서 수정)
├── business-partner/
│   ├── business-partner.service.ts                (T1)
│   ├── business-partner.service.spec.ts           (T1)
│   ├── business-partner.controller.ts             (T1)
│   └── dto/
│       ├── create-business-partner.dto.ts         (T1 — CreateAddressDto, CreateBusinessProfileDto, CreateContactDto, CreateBusinessPartnerDto 포함)
│       ├── update-business-partner.dto.ts         (T1 — UpdateAddressDto, UpdateBusinessProfileDto, UpdateContactDto, UpdateBusinessPartnerDto 포함)
│       └── query-business-partner.dto.ts          (T1)
├── customer/
│   ├── customer.service.ts                        (T2)
│   ├── customer.service.spec.ts                   (T2)
│   ├── customer.controller.ts                     (T2)
│   └── dto/
│       ├── create-customer.dto.ts                 (T2 — CreateIndividualProfileDto, CreateCustomerDto 포함)
│       ├── update-customer.dto.ts                 (T2 — UpdateIndividualProfileDto, UpdateCustomerDto 포함)
│       └── query-customer.dto.ts                  (T2)
└── assignment/
    ├── assignment.service.ts                      (T3)
    ├── assignment.service.spec.ts                 (T3)
    ├── assignment.controller.ts                   (T3)
    └── dto/
        ├── create-assignment.dto.ts               (T3)
        └── update-assignment.dto.ts               (T3)

src/app.module.ts                                  (T1에서 CustomerModule 등록)
```

---

## Task 1: CustomerModule + BusinessPartner CRUD (contacts 포함)

**Files:**
- Create: `src/customer/customer.module.ts`
- Create: `src/customer/business-partner/dto/create-business-partner.dto.ts`
- Create: `src/customer/business-partner/dto/update-business-partner.dto.ts`
- Create: `src/customer/business-partner/dto/query-business-partner.dto.ts`
- Create: `src/customer/business-partner/business-partner.service.ts`
- Create: `src/customer/business-partner/business-partner.service.spec.ts`
- Create: `src/customer/business-partner/business-partner.controller.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- Produces:
  - `BusinessPartnerService.create(organizationId: string, dto: CreateBusinessPartnerDto): Promise<{ id: string }>`
  - `BusinessPartnerService.findAll(organizationId: string, query: QueryBusinessPartnerDto): Promise<...>`
  - `BusinessPartnerService.findOne(organizationId: string, id: string): Promise<...>`
  - `BusinessPartnerService.update(organizationId: string, id: string, dto: UpdateBusinessPartnerDto): Promise<void>`
  - `BusinessPartnerService.softDelete(organizationId: string, id: string): Promise<void>`
  - `BusinessPartnerService.addContact(organizationId: string, partnerId: string, dto: CreateContactDto): Promise<{ id: string }>`
  - `BusinessPartnerService.updateContact(organizationId: string, partnerId: string, contactId: string, dto: UpdateContactDto): Promise<void>`
  - `BusinessPartnerService.removeContact(organizationId: string, partnerId: string, contactId: string): Promise<void>`
  - `CreateAddressDto`, `CreateBusinessProfileDto`, `CreateContactDto`, `CreateBusinessPartnerDto` (T2에서 import)
  - `UpdateAddressDto`, `UpdateContactDto` (T2에서 import)

- [ ] **Step 1: DTO 파일 작성**

`src/customer/business-partner/dto/create-business-partner.dto.ts`:

```typescript
import { IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { BusinessPartnerRoleType } from '@prisma/client';

export class CreateAddressDto {
  @IsString() zonecode: string;
  @IsString() address: string;
  @IsString() @IsOptional() addressDetail?: string;
  @IsString() @IsOptional() jibunAddress?: string;
  @IsString() @IsOptional() roadAddress?: string;
  @IsString() @IsOptional() buildingName?: string;
}

export class CreateBusinessProfileDto {
  @IsString() name: string;
  @IsString() businessRegistrationNo: string;
  @IsString() representativeName: string;
  @IsString() @IsOptional() businessType?: string;
  @IsString() @IsOptional() businessItem?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @ValidateNested() @Type(() => CreateAddressDto) address: CreateAddressDto;
}

export class CreateContactDto {
  @IsString() name: string;
  @IsString() @IsOptional() department?: string;
  @IsString() @IsOptional() position?: string;
  @IsString() @IsOptional() role?: string;
  @IsString() @IsOptional() phone?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsBoolean() @IsOptional() isPrimary?: boolean;
  @IsString() @IsOptional() memo?: string;
}

export class CreateBusinessPartnerDto {
  @IsEnum(BusinessPartnerRoleType, { each: true })
  @IsArray()
  @ArrayMinSize(1)
  roles: BusinessPartnerRoleType[];

  @IsString() @IsOptional() memo?: string;

  @ValidateNested()
  @Type(() => CreateBusinessProfileDto)
  businessProfile: CreateBusinessProfileDto;

  @ValidateNested({ each: true })
  @Type(() => CreateContactDto)
  @IsArray()
  @IsOptional()
  contacts?: CreateContactDto[];
}
```

`src/customer/business-partner/dto/update-business-partner.dto.ts`:

```typescript
import { IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BusinessPartnerRoleType } from '@prisma/client';

export class UpdateAddressDto {
  @IsString() @IsOptional() zonecode?: string;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() addressDetail?: string;
  @IsString() @IsOptional() jibunAddress?: string;
  @IsString() @IsOptional() roadAddress?: string;
  @IsString() @IsOptional() buildingName?: string;
}

export class UpdateBusinessProfileDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() businessRegistrationNo?: string;
  @IsString() @IsOptional() representativeName?: string;
  @IsString() @IsOptional() businessType?: string;
  @IsString() @IsOptional() businessItem?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @ValidateNested() @Type(() => UpdateAddressDto) @IsOptional() address?: UpdateAddressDto;
}

export class UpdateContactDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() department?: string;
  @IsString() @IsOptional() position?: string;
  @IsString() @IsOptional() role?: string;
  @IsString() @IsOptional() phone?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsBoolean() @IsOptional() isPrimary?: boolean;
  @IsString() @IsOptional() memo?: string;
}

export class UpdateBusinessPartnerDto {
  @IsString() @IsOptional() memo?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsEnum(BusinessPartnerRoleType, { each: true }) @IsArray() @IsOptional() roles?: BusinessPartnerRoleType[];
  @ValidateNested() @Type(() => UpdateBusinessProfileDto) @IsOptional() businessProfile?: UpdateBusinessProfileDto;
}
```

`src/customer/business-partner/dto/query-business-partner.dto.ts`:

```typescript
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { BusinessPartnerRoleType } from '@prisma/client';

export class QueryBusinessPartnerDto {
  @IsEnum(BusinessPartnerRoleType) @IsOptional() role?: BusinessPartnerRoleType;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsString() @IsOptional() q?: string;
  @IsInt() @Min(1) @IsOptional() page?: number;
  @IsInt() @Min(1) @Max(100) @IsOptional() limit?: number;
}
```

- [ ] **Step 2: 서비스 spec 작성 (실패 확인)**

`src/customer/business-partner/business-partner.service.spec.ts`:

```typescript
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BusinessPartnerService } from './business-partner.service';

describe('BusinessPartnerService', () => {
  let service: BusinessPartnerService;
  let prisma: {
    $transaction: jest.Mock;
    address: { create: jest.Mock; update: jest.Mock };
    businessProfile: { create: jest.Mock; update: jest.Mock; findUnique: jest.Mock };
    businessPartner: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    businessPartnerRole: { createMany: jest.Mock; deleteMany: jest.Mock };
    businessPartnerContact: { createMany: jest.Mock; create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; delete: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
      address: { create: jest.fn(), update: jest.fn() },
      businessProfile: { create: jest.fn(), update: jest.fn(), findUnique: jest.fn() },
      businessPartner: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      businessPartnerRole: { createMany: jest.fn(), deleteMany: jest.fn() },
      businessPartnerContact: { createMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [BusinessPartnerService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(BusinessPartnerService);
  });

  describe('create', () => {
    it('creates address, businessProfile, businessPartner, roles, and contacts in transaction', async () => {
      prisma.address.create.mockResolvedValue({ id: 'addr-1' });
      prisma.businessProfile.create.mockResolvedValue({ id: 'bp-1' });
      prisma.businessPartner.create.mockResolvedValue({ id: 'partner-1' });
      prisma.businessPartnerRole.createMany.mockResolvedValue({ count: 1 });
      prisma.businessPartnerContact.createMany.mockResolvedValue({ count: 1 });

      const result = await service.create('org-1', {
        roles: ['SALES'],
        businessProfile: {
          name: '(주)ABC',
          businessRegistrationNo: '000-00-00000',
          representativeName: '홍길동',
          address: { zonecode: '12345', address: '서울시 강남구' },
        },
        contacts: [{ name: '김담당', isPrimary: true }],
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.address.create).toHaveBeenCalled();
      expect(prisma.businessProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: '(주)ABC', addressId: 'addr-1' }) }),
      );
      expect(prisma.businessPartner.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org-1', businessProfileId: 'bp-1' }) }),
      );
      expect(prisma.businessPartnerRole.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: [{ organizationId: 'org-1', businessPartnerId: 'partner-1', type: 'SALES' }] }),
      );
      expect(result).toEqual({ id: 'partner-1' });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when partner not found', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue(null);
      await expect(service.findOne('org-1', 'p-x')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when partner is soft-deleted', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue({ id: 'p-1', deletedAt: new Date() });
      await expect(service.findOne('org-1', 'p-1')).rejects.toThrow(NotFoundException);
    });

    it('returns partner with contacts', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue({ id: 'p-1', deletedAt: null, contacts: [] });
      const result = await service.findOne('org-1', 'p-1');
      expect(result).toMatchObject({ id: 'p-1' });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when partner not found', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue(null);
      await expect(service.update('org-1', 'p-x', {})).rejects.toThrow(NotFoundException);
    });

    it('updates businessProfile name', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue({ id: 'p-1', businessProfileId: 'bp-1', deletedAt: null });
      prisma.businessProfile.update.mockResolvedValue({});

      await service.update('org-1', 'p-1', { businessProfile: { name: '새이름' } });

      expect(prisma.businessProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'bp-1' }, data: expect.objectContaining({ name: '새이름' }) }),
      );
    });

    it('replaces roles when roles array provided', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue({ id: 'p-1', businessProfileId: 'bp-1', deletedAt: null });
      prisma.businessPartnerRole.deleteMany.mockResolvedValue({});
      prisma.businessPartnerRole.createMany.mockResolvedValue({});

      await service.update('org-1', 'p-1', { roles: ['PURCHASE'] });

      expect(prisma.businessPartnerRole.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessPartnerId: 'p-1', organizationId: 'org-1' } }),
      );
      expect(prisma.businessPartnerRole.createMany).toHaveBeenCalled();
    });
  });

  describe('softDelete', () => {
    it('throws NotFoundException when not found', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue(null);
      await expect(service.softDelete('org-1', 'p-x')).rejects.toThrow(NotFoundException);
    });

    it('sets deletedAt and isActive=false', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue({ id: 'p-1', deletedAt: null });
      prisma.businessPartner.update.mockResolvedValue({});

      await service.softDelete('org-1', 'p-1');

      expect(prisma.businessPartner.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
      );
      expect(prisma.businessPartner.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('addContact', () => {
    it('throws NotFoundException when partner not found', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue(null);
      await expect(service.addContact('org-1', 'p-x', { name: '김담당' })).rejects.toThrow(NotFoundException);
    });

    it('creates contact', async () => {
      prisma.businessPartner.findUnique.mockResolvedValue({ id: 'p-1', deletedAt: null });
      prisma.businessPartnerContact.create.mockResolvedValue({ id: 'c-1' });

      const result = await service.addContact('org-1', 'p-1', { name: '김담당', isPrimary: true });

      expect(prisma.businessPartnerContact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org-1', businessPartnerId: 'p-1', name: '김담당' }),
        }),
      );
      expect(result).toEqual({ id: 'c-1' });
    });
  });

  describe('updateContact', () => {
    it('throws NotFoundException when contact not found or wrong partner', async () => {
      prisma.businessPartnerContact.findUnique.mockResolvedValue(null);
      await expect(service.updateContact('org-1', 'p-1', 'c-x', { name: '새이름' })).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when contact belongs to different partner', async () => {
      prisma.businessPartnerContact.findUnique.mockResolvedValue({ id: 'c-1', businessPartnerId: 'other-p' });
      await expect(service.updateContact('org-1', 'p-1', 'c-1', { name: '새이름' })).rejects.toThrow(NotFoundException);
    });

    it('updates contact fields', async () => {
      prisma.businessPartnerContact.findUnique.mockResolvedValue({ id: 'c-1', businessPartnerId: 'p-1' });
      prisma.businessPartnerContact.update.mockResolvedValue({});

      await service.updateContact('org-1', 'p-1', 'c-1', { name: '새이름' });

      expect(prisma.businessPartnerContact.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: '새이름' }) }),
      );
    });
  });

  describe('removeContact', () => {
    it('throws NotFoundException when not found', async () => {
      prisma.businessPartnerContact.findUnique.mockResolvedValue(null);
      await expect(service.removeContact('org-1', 'p-1', 'c-x')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when contact is referenced by assignments', async () => {
      prisma.businessPartnerContact.findUnique.mockResolvedValue({ id: 'c-1', businessPartnerId: 'p-1' });
      const fkError = new Prisma.PrismaClientKnownRequestError('FK violation', { code: 'P2003', clientVersion: '7' });
      prisma.businessPartnerContact.delete.mockRejectedValue(fkError);

      await expect(service.removeContact('org-1', 'p-1', 'c-1')).rejects.toThrow(ConflictException);
    });

    it('deletes contact', async () => {
      prisma.businessPartnerContact.findUnique.mockResolvedValue({ id: 'c-1', businessPartnerId: 'p-1' });
      prisma.businessPartnerContact.delete.mockResolvedValue({});

      await service.removeContact('org-1', 'p-1', 'c-1');

      expect(prisma.businessPartnerContact.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id_organizationId: { id: 'c-1', organizationId: 'org-1' } } }),
      );
    });
  });
});
```

- [ ] **Step 3: 테스트 실행 — 실패 확인**

```bash
cd apps/api && pnpm test -- business-partner.service.spec.ts
```

Expected: `Cannot find module './business-partner.service'`

- [ ] **Step 4: 서비스 구현**

`src/customer/business-partner/business-partner.service.ts`:

```typescript
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
        await tx.businessPartnerRole.deleteMany({ where: { businessPartnerId: id, organizationId } });
        if (dto.roles.length) {
          await tx.businessPartnerRole.createMany({
            data: dto.roles.map((type) => ({ organizationId, businessPartnerId: id, type })),
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

  async updateContact(organizationId: string, partnerId: string, contactId: string, dto: UpdateContactDto): Promise<void> {
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
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd apps/api && pnpm test -- business-partner.service.spec.ts
```

Expected: 모든 테스트 PASS

- [ ] **Step 6: 컨트롤러 작성**

`src/customer/business-partner/business-partner.controller.ts`:

```typescript
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { BusinessPartnerService } from './business-partner.service';
import { CreateBusinessPartnerDto, CreateContactDto } from './dto/create-business-partner.dto';
import { UpdateBusinessPartnerDto, UpdateContactDto } from './dto/update-business-partner.dto';
import { QueryBusinessPartnerDto } from './dto/query-business-partner.dto';

@ApiTags('business-partners')
@Controller('business-partners')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class BusinessPartnerController {
  constructor(private readonly service: BusinessPartnerService) {}

  @Get()
  async findAll(@Query() query: QueryBusinessPartnerDto, @OrgCtx() ctx: OrgContext) {
    return this.service.findAll(ctx.organizationId, query);
  }

  @Post()
  async create(@Body() dto: CreateBusinessPartnerDto, @OrgCtx() ctx: OrgContext) {
    return this.service.create(ctx.organizationId, dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.findOne(ctx.organizationId, id);
  }

  @Patch(':id')
  @HttpCode(200)
  async update(@Param('id') id: string, @Body() dto: UpdateBusinessPartnerDto, @OrgCtx() ctx: OrgContext) {
    return this.service.update(ctx.organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  async softDelete(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.softDelete(ctx.organizationId, id);
  }

  @Post(':id/contacts')
  async addContact(@Param('id') id: string, @Body() dto: CreateContactDto, @OrgCtx() ctx: OrgContext) {
    return this.service.addContact(ctx.organizationId, id, dto);
  }

  @Patch(':id/contacts/:contactId')
  @HttpCode(200)
  async updateContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateContactDto,
    @OrgCtx() ctx: OrgContext,
  ) {
    return this.service.updateContact(ctx.organizationId, id, contactId, dto);
  }

  @Delete(':id/contacts/:contactId')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  async removeContact(@Param('id') id: string, @Param('contactId') contactId: string, @OrgCtx() ctx: OrgContext) {
    return this.service.removeContact(ctx.organizationId, id, contactId);
  }
}
```

- [ ] **Step 7: CustomerModule + AppModule 등록**

`src/customer/customer.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { BusinessPartnerController } from './business-partner/business-partner.controller';
import { BusinessPartnerService } from './business-partner/business-partner.service';

@Module({
  imports: [OrganizationModule],
  providers: [BusinessPartnerService],
  controllers: [BusinessPartnerController],
})
export class CustomerModule {}
```

`src/app.module.ts` — `CustomerModule` import 추가:

```typescript
import { CustomerModule } from './customer/customer.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    PrismaModule,
    MailModule,
    AuthModule,
    OrganizationModule,
    CustomerModule,   // 추가
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

- [ ] **Step 8: 빌드 및 전체 테스트 확인**

```bash
cd apps/api && pnpm build && pnpm test
```

Expected: build 성공, 전체 테스트 PASS

- [ ] **Step 9: 커밋**

```bash
git add apps/api/src/customer apps/api/src/app.module.ts
git commit -m "feat(customer): add BusinessPartner CRUD and contacts sub-resource"
```

---

## Task 2: Customer CRUD

**Files:**
- Create: `src/customer/customer/dto/create-customer.dto.ts`
- Create: `src/customer/customer/dto/update-customer.dto.ts`
- Create: `src/customer/customer/dto/query-customer.dto.ts`
- Create: `src/customer/customer/customer.service.ts`
- Create: `src/customer/customer/customer.service.spec.ts`
- Create: `src/customer/customer/customer.controller.ts`
- Modify: `src/customer/customer.module.ts`

**Interfaces:**
- Consumes (from T1):
  - `CreateAddressDto` from `../../business-partner/dto/create-business-partner.dto`
  - `CreateBusinessPartnerDto` from `../../business-partner/dto/create-business-partner.dto`
  - `UpdateAddressDto` from `../../business-partner/dto/update-business-partner.dto`
- Produces:
  - `CustomerService.create(organizationId, dto): Promise<{ id: string }>`
  - `CustomerService.findAll(organizationId, query): Promise<...>`
  - `CustomerService.findOne(organizationId, id): Promise<...>`
  - `CustomerService.update(organizationId, id, dto): Promise<void>`
  - `CustomerService.softDelete(organizationId, id): Promise<void>`

- [ ] **Step 1: DTO 파일 작성**

`src/customer/customer/dto/create-customer.dto.ts`:

```typescript
import { IsDefined, IsEmail, IsEnum, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CustomerType } from '@prisma/client';
import { CreateAddressDto, CreateBusinessPartnerDto } from '../../business-partner/dto/create-business-partner.dto';

export class CreateIndividualProfileDto {
  @IsString() name: string;
  @IsString() @IsOptional() phone?: string;
  @IsEmail() @IsOptional() email?: string;
  @ValidateNested() @Type(() => CreateAddressDto) @IsOptional() address?: CreateAddressDto;
}

export class CreateCustomerDto {
  @IsEnum(CustomerType) type: CustomerType;
  @IsString() @IsOptional() memo?: string;

  @ValidateIf((o: CreateCustomerDto) => o.type === CustomerType.INDIVIDUAL)
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateIndividualProfileDto)
  individualProfile?: CreateIndividualProfileDto;

  @ValidateIf((o: CreateCustomerDto) => o.type === CustomerType.BUSINESS)
  @IsDefined()
  @ValidateNested()
  @Type(() => CreateBusinessPartnerDto)
  businessPartner?: CreateBusinessPartnerDto;
}
```

`src/customer/customer/dto/update-customer.dto.ts`:

```typescript
import { IsBoolean, IsEmail, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateAddressDto } from '../../business-partner/dto/update-business-partner.dto';

export class UpdateIndividualProfileDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() phone?: string;
  @IsEmail() @IsOptional() email?: string;
  @ValidateNested() @Type(() => UpdateAddressDto) @IsOptional() address?: UpdateAddressDto;
}

export class UpdateCustomerDto {
  @IsString() @IsOptional() memo?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @ValidateNested() @Type(() => UpdateIndividualProfileDto) @IsOptional() individualProfile?: UpdateIndividualProfileDto;
}
```

`src/customer/customer/dto/query-customer.dto.ts`:

```typescript
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { CustomerType } from '@prisma/client';

export class QueryCustomerDto {
  @IsEnum(CustomerType) @IsOptional() type?: CustomerType;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsString() @IsOptional() q?: string;
  @IsInt() @Min(1) @IsOptional() page?: number;
  @IsInt() @Min(1) @Max(100) @IsOptional() limit?: number;
}
```

- [ ] **Step 2: 서비스 spec 작성 (실패 확인)**

`src/customer/customer/customer.service.spec.ts`:

```typescript
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { CustomerService } from './customer.service';

describe('CustomerService', () => {
  let service: CustomerService;
  let prisma: {
    $transaction: jest.Mock;
    address: { create: jest.Mock; update: jest.Mock };
    businessProfile: { create: jest.Mock };
    businessPartner: { create: jest.Mock };
    businessPartnerRole: { createMany: jest.Mock };
    businessPartnerContact: { createMany: jest.Mock };
    individualProfile: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    customer: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
      address: { create: jest.fn(), update: jest.fn() },
      businessProfile: { create: jest.fn() },
      businessPartner: { create: jest.fn() },
      businessPartnerRole: { createMany: jest.fn() },
      businessPartnerContact: { createMany: jest.fn() },
      individualProfile: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      customer: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [CustomerService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(CustomerService);
  });

  describe('create INDIVIDUAL', () => {
    it('creates IndividualProfile and Customer in transaction', async () => {
      prisma.individualProfile.create.mockResolvedValue({ id: 'profile-1' });
      prisma.customer.create.mockResolvedValue({ id: 'cust-1' });

      const result = await service.create('org-1', {
        type: 'INDIVIDUAL',
        individualProfile: { name: '홍길동', phone: '010-0000-0000' },
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.individualProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: '홍길동' }) }),
      );
      expect(prisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org-1', type: 'INDIVIDUAL', individualProfileId: 'profile-1' }),
        }),
      );
      expect(result).toEqual({ id: 'cust-1' });
    });

    it('creates Address when address provided', async () => {
      prisma.address.create.mockResolvedValue({ id: 'addr-1' });
      prisma.individualProfile.create.mockResolvedValue({ id: 'profile-1' });
      prisma.customer.create.mockResolvedValue({ id: 'cust-1' });

      await service.create('org-1', {
        type: 'INDIVIDUAL',
        individualProfile: {
          name: '홍길동',
          address: { zonecode: '12345', address: '서울시' },
        },
      });

      expect(prisma.address.create).toHaveBeenCalled();
      expect(prisma.individualProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ addressId: 'addr-1' }) }),
      );
    });
  });

  describe('create BUSINESS', () => {
    it('creates BusinessProfile, BusinessPartner, roles, contacts, and Customer in transaction', async () => {
      prisma.address.create.mockResolvedValue({ id: 'addr-1' });
      prisma.businessProfile.create.mockResolvedValue({ id: 'bp-1' });
      prisma.businessPartner.create.mockResolvedValue({ id: 'partner-1' });
      prisma.businessPartnerRole.createMany.mockResolvedValue({ count: 1 });
      prisma.customer.create.mockResolvedValue({ id: 'cust-1' });

      const result = await service.create('org-1', {
        type: 'BUSINESS',
        businessPartner: {
          roles: ['SALES'],
          businessProfile: {
            name: '(주)ABC',
            businessRegistrationNo: '000-00-00000',
            representativeName: '홍길동',
            address: { zonecode: '12345', address: '서울시' },
          },
        },
      });

      expect(prisma.businessPartner.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org-1', businessProfileId: 'bp-1' }) }),
      );
      expect(prisma.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'BUSINESS', businessPartnerId: 'partner-1' }),
        }),
      );
      expect(result).toEqual({ id: 'cust-1' });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when customer not found', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.findOne('org-1', 'c-x')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when soft-deleted', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: new Date() });
      await expect(service.findOne('org-1', 'c-1')).rejects.toThrow(NotFoundException);
    });

    it('returns customer', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: null, individualProfile: { name: '홍길동' } });
      const result = await service.findOne('org-1', 'c-1');
      expect(result).toMatchObject({ id: 'c-1' });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when not found', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.update('org-1', 'c-x', { memo: '...' })).rejects.toThrow(NotFoundException);
    });

    it('updates customer memo', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', type: 'INDIVIDUAL', individualProfileId: 'p-1', deletedAt: null });
      prisma.customer.update.mockResolvedValue({});

      await service.update('org-1', 'c-1', { memo: '새메모' });

      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ memo: '새메모' }) }),
      );
    });

    it('updates individualProfile name for INDIVIDUAL customer', async () => {
      prisma.customer.findUnique.mockResolvedValue({
        id: 'c-1', type: 'INDIVIDUAL', individualProfileId: 'p-1', deletedAt: null,
      });
      prisma.individualProfile.update.mockResolvedValue({});

      await service.update('org-1', 'c-1', { individualProfile: { name: '새이름' } });

      expect(prisma.individualProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'p-1' }, data: expect.objectContaining({ name: '새이름' }) }),
      );
    });
  });

  describe('softDelete', () => {
    it('throws NotFoundException when not found', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.softDelete('org-1', 'c-x')).rejects.toThrow(NotFoundException);
    });

    it('sets deletedAt and isActive=false', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: null });
      prisma.customer.update.mockResolvedValue({});

      await service.softDelete('org-1', 'c-1');

      expect(prisma.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isActive: false }) }),
      );
    });
  });
});
```

- [ ] **Step 3: 테스트 실행 — 실패 확인**

```bash
cd apps/api && pnpm test -- customer.service.spec.ts
```

Expected: `Cannot find module './customer.service'`

- [ ] **Step 4: 서비스 구현**

`src/customer/customer/customer.service.ts`:

```typescript
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
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd apps/api && pnpm test -- customer.service.spec.ts
```

Expected: 모든 테스트 PASS

- [ ] **Step 6: 컨트롤러 작성**

`src/customer/customer/customer.controller.ts`:

```typescript
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CustomerService } from './customer.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { QueryCustomerDto } from './dto/query-customer.dto';

@ApiTags('customers')
@Controller('customers')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class CustomerController {
  constructor(private readonly service: CustomerService) {}

  @Get()
  async findAll(@Query() query: QueryCustomerDto, @OrgCtx() ctx: OrgContext) {
    return this.service.findAll(ctx.organizationId, query);
  }

  @Post()
  async create(@Body() dto: CreateCustomerDto, @OrgCtx() ctx: OrgContext) {
    return this.service.create(ctx.organizationId, dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.findOne(ctx.organizationId, id);
  }

  @Patch(':id')
  @HttpCode(200)
  async update(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @OrgCtx() ctx: OrgContext) {
    return this.service.update(ctx.organizationId, id, dto);
  }

  @Delete(':id')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  async softDelete(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.softDelete(ctx.organizationId, id);
  }
}
```

- [ ] **Step 7: CustomerModule 업데이트**

`src/customer/customer.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { BusinessPartnerController } from './business-partner/business-partner.controller';
import { BusinessPartnerService } from './business-partner/business-partner.service';
import { CustomerController } from './customer/customer.controller';
import { CustomerService } from './customer/customer.service';

@Module({
  imports: [OrganizationModule],
  providers: [BusinessPartnerService, CustomerService],
  controllers: [BusinessPartnerController, CustomerController],
})
export class CustomerModule {}
```

- [ ] **Step 8: 빌드 및 전체 테스트 확인**

```bash
cd apps/api && pnpm build && pnpm test
```

Expected: build 성공, 전체 테스트 PASS

- [ ] **Step 9: 커밋**

```bash
git add apps/api/src/customer
git commit -m "feat(customer): add Customer CRUD with INDIVIDUAL and BUSINESS types"
```

---

## Task 3: CustomerAssignment CRUD

**Files:**
- Create: `src/customer/assignment/dto/create-assignment.dto.ts`
- Create: `src/customer/assignment/dto/update-assignment.dto.ts`
- Create: `src/customer/assignment/assignment.service.ts`
- Create: `src/customer/assignment/assignment.service.spec.ts`
- Create: `src/customer/assignment/assignment.controller.ts`
- Modify: `src/customer/customer.module.ts`

**Interfaces:**
- Produces:
  - `AssignmentService.list(organizationId, customerId): Promise<...>`
  - `AssignmentService.create(organizationId, customerId, dto): Promise<{ id: string }>`
  - `AssignmentService.update(organizationId, customerId, assignmentId, dto): Promise<void>`
  - `AssignmentService.remove(organizationId, customerId, assignmentId): Promise<void>`

- [ ] **Step 1: DTO 파일 작성**

`src/customer/assignment/dto/create-assignment.dto.ts`:

```typescript
import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateAssignmentDto {
  @IsString() organizationMemberId: string;
  @IsString() @IsOptional() customerContactId?: string;
  @IsString() @IsOptional() individualProfileId?: string;
  @IsString() @IsOptional() role?: string;
  @IsBoolean() @IsOptional() isPrimary?: boolean;
  @IsDateString() @IsOptional() startedAt?: string;
  @IsDateString() @IsOptional() endedAt?: string;
  @IsString() @IsOptional() memo?: string;
}
```

`src/customer/assignment/dto/update-assignment.dto.ts`:

```typescript
import { IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateAssignmentDto {
  @IsString() @IsOptional() role?: string;
  @IsBoolean() @IsOptional() isPrimary?: boolean;
  @IsDateString() @IsOptional() startedAt?: string;
  @IsDateString() @IsOptional() endedAt?: string;
  @IsString() @IsOptional() memo?: string;
  @IsString() @IsOptional() customerContactId?: string;
}
```

- [ ] **Step 2: 서비스 spec 작성 (실패 확인)**

`src/customer/assignment/assignment.service.spec.ts`:

```typescript
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignmentService } from './assignment.service';

describe('AssignmentService', () => {
  let service: AssignmentService;
  let prisma: {
    $transaction: jest.Mock;
    customer: { findUnique: jest.Mock };
    organizationMember: { findUnique: jest.Mock };
    customerAssignment: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
      customer: { findUnique: jest.fn() },
      organizationMember: { findUnique: jest.fn() },
      customerAssignment: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [AssignmentService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AssignmentService);
  });

  describe('list', () => {
    it('throws NotFoundException when customer not found', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.list('org-1', 'c-x')).rejects.toThrow(NotFoundException);
    });

    it('returns assignments ordered by isPrimary desc', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: null });
      prisma.customerAssignment.findMany.mockResolvedValue([{ id: 'a-1', isPrimary: true }]);

      const result = await service.list('org-1', 'c-1');

      expect(prisma.customerAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { customerId: 'c-1', organizationId: 'org-1' } }),
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('throws NotFoundException when customer not found', async () => {
      prisma.customer.findUnique.mockResolvedValue(null);
      await expect(service.create('org-1', 'c-x', { organizationMemberId: 'm-1' })).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when member not found or inactive', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: null });
      prisma.organizationMember.findUnique.mockResolvedValue(null);
      await expect(service.create('org-1', 'c-1', { organizationMemberId: 'm-x' })).rejects.toThrow(NotFoundException);
    });

    it('deactivates existing primary when isPrimary is true', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: null });
      prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm-1', isActive: true });
      prisma.customerAssignment.updateMany.mockResolvedValue({ count: 1 });
      prisma.customerAssignment.create.mockResolvedValue({ id: 'a-1' });

      await service.create('org-1', 'c-1', { organizationMemberId: 'm-1', isPrimary: true });

      expect(prisma.customerAssignment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ customerId: 'c-1', isPrimary: true }),
          data: { isPrimary: false },
        }),
      );
    });

    it('creates assignment and returns id', async () => {
      prisma.customer.findUnique.mockResolvedValue({ id: 'c-1', deletedAt: null });
      prisma.organizationMember.findUnique.mockResolvedValue({ id: 'm-1', isActive: true });
      prisma.customerAssignment.create.mockResolvedValue({ id: 'a-1' });

      const result = await service.create('org-1', 'c-1', { organizationMemberId: 'm-1' });

      expect(prisma.customerAssignment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org-1', customerId: 'c-1', organizationMemberId: 'm-1' }),
        }),
      );
      expect(result).toEqual({ id: 'a-1' });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when assignment not found', async () => {
      prisma.customerAssignment.findUnique.mockResolvedValue(null);
      await expect(service.update('org-1', 'c-1', 'a-x', {})).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when assignment belongs to different customer', async () => {
      prisma.customerAssignment.findUnique.mockResolvedValue({ id: 'a-1', customerId: 'other-c', organizationId: 'org-1' });
      await expect(service.update('org-1', 'c-1', 'a-1', {})).rejects.toThrow(NotFoundException);
    });

    it('deactivates other primaries when isPrimary is true', async () => {
      prisma.customerAssignment.findUnique.mockResolvedValue({ id: 'a-1', customerId: 'c-1', organizationId: 'org-1' });
      prisma.customerAssignment.updateMany.mockResolvedValue({ count: 1 });
      prisma.customerAssignment.update.mockResolvedValue({});

      await service.update('org-1', 'c-1', 'a-1', { isPrimary: true });

      expect(prisma.customerAssignment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { not: 'a-1' }, isPrimary: true }),
          data: { isPrimary: false },
        }),
      );
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when assignment not found', async () => {
      prisma.customerAssignment.findUnique.mockResolvedValue(null);
      await expect(service.remove('org-1', 'c-1', 'a-x')).rejects.toThrow(NotFoundException);
    });

    it('deletes assignment', async () => {
      prisma.customerAssignment.findUnique.mockResolvedValue({ id: 'a-1', customerId: 'c-1', organizationId: 'org-1' });
      prisma.customerAssignment.delete.mockResolvedValue({});

      await service.remove('org-1', 'c-1', 'a-1');

      expect(prisma.customerAssignment.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'a-1' } }),
      );
    });
  });
});
```

- [ ] **Step 3: 테스트 실행 — 실패 확인**

```bash
cd apps/api && pnpm test -- assignment.service.spec.ts
```

Expected: `Cannot find module './assignment.service'`

- [ ] **Step 4: 서비스 구현**

`src/customer/assignment/assignment.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateAssignmentDto } from './dto/create-assignment.dto';
import type { UpdateAssignmentDto } from './dto/update-assignment.dto';

@Injectable()
export class AssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id_organizationId: { id: customerId, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!customer || customer.deletedAt) throw new NotFoundException('고객을 찾을 수 없습니다.');

    return this.prisma.customerAssignment.findMany({
      where: { customerId, organizationId },
      include: {
        organizationMember: { select: { id: true, name: true, role: true } },
        customerContact: { select: { id: true, name: true, department: true } },
      },
      orderBy: [{ isPrimary: 'desc' }, { startedAt: 'desc' }],
    });
  }

  async create(organizationId: string, customerId: string, dto: CreateAssignmentDto): Promise<{ id: string }> {
    const customer = await this.prisma.customer.findUnique({
      where: { id_organizationId: { id: customerId, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!customer || customer.deletedAt) throw new NotFoundException('고객을 찾을 수 없습니다.');

    const member = await this.prisma.organizationMember.findUnique({
      where: { id_organizationId: { id: dto.organizationMemberId, organizationId } },
      select: { id: true, isActive: true },
    });
    if (!member || !member.isActive) throw new NotFoundException('담당 직원을 찾을 수 없습니다.');

    const assignment = await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.customerAssignment.updateMany({
          where: { customerId, organizationId, isPrimary: true, endedAt: null },
          data: { isPrimary: false },
        });
      }
      return tx.customerAssignment.create({
        data: {
          organizationId,
          customerId,
          organizationMemberId: dto.organizationMemberId,
          customerContactId: dto.customerContactId,
          individualProfileId: dto.individualProfileId,
          role: dto.role,
          isPrimary: dto.isPrimary ?? false,
          startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
          endedAt: dto.endedAt ? new Date(dto.endedAt) : undefined,
          memo: dto.memo,
        },
      });
    });
    return { id: assignment.id };
  }

  async update(organizationId: string, customerId: string, assignmentId: string, dto: UpdateAssignmentDto): Promise<void> {
    const assignment = await this.prisma.customerAssignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, customerId: true, organizationId: true },
    });
    if (!assignment || assignment.customerId !== customerId || assignment.organizationId !== organizationId) {
      throw new NotFoundException('배정을 찾을 수 없습니다.');
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.isPrimary) {
        await tx.customerAssignment.updateMany({
          where: { customerId, organizationId, isPrimary: true, endedAt: null, id: { not: assignmentId } },
          data: { isPrimary: false },
        });
      }
      const data = Object.fromEntries(
        Object.entries({
          role: dto.role,
          isPrimary: dto.isPrimary,
          startedAt: dto.startedAt ? new Date(dto.startedAt) : undefined,
          endedAt: dto.endedAt ? new Date(dto.endedAt) : undefined,
          memo: dto.memo,
          customerContactId: dto.customerContactId,
        }).filter(([, v]) => v !== undefined),
      );
      if (Object.keys(data).length) {
        await tx.customerAssignment.update({ where: { id: assignmentId }, data });
      }
    });
  }

  async remove(organizationId: string, customerId: string, assignmentId: string): Promise<void> {
    const assignment = await this.prisma.customerAssignment.findUnique({
      where: { id: assignmentId },
      select: { id: true, customerId: true, organizationId: true },
    });
    if (!assignment || assignment.customerId !== customerId || assignment.organizationId !== organizationId) {
      throw new NotFoundException('배정을 찾을 수 없습니다.');
    }
    await this.prisma.customerAssignment.delete({ where: { id: assignmentId } });
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd apps/api && pnpm test -- assignment.service.spec.ts
```

Expected: 모든 테스트 PASS

- [ ] **Step 6: 컨트롤러 작성**

`src/customer/assignment/assignment.controller.ts`:

```typescript
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AssignmentService } from './assignment.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';

@ApiTags('customers')
@Controller('customers/:customerId/assignments')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class AssignmentController {
  constructor(private readonly service: AssignmentService) {}

  @Get()
  async list(@Param('customerId') customerId: string, @OrgCtx() ctx: OrgContext) {
    return this.service.list(ctx.organizationId, customerId);
  }

  @Post()
  async create(@Param('customerId') customerId: string, @Body() dto: CreateAssignmentDto, @OrgCtx() ctx: OrgContext) {
    return this.service.create(ctx.organizationId, customerId, dto);
  }

  @Patch(':assignmentId')
  @HttpCode(200)
  async update(
    @Param('customerId') customerId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: UpdateAssignmentDto,
    @OrgCtx() ctx: OrgContext,
  ) {
    return this.service.update(ctx.organizationId, customerId, assignmentId, dto);
  }

  @Delete(':assignmentId')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  async remove(
    @Param('customerId') customerId: string,
    @Param('assignmentId') assignmentId: string,
    @OrgCtx() ctx: OrgContext,
  ) {
    return this.service.remove(ctx.organizationId, customerId, assignmentId);
  }
}
```

- [ ] **Step 7: CustomerModule 최종 업데이트**

`src/customer/customer.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { BusinessPartnerController } from './business-partner/business-partner.controller';
import { BusinessPartnerService } from './business-partner/business-partner.service';
import { CustomerController } from './customer/customer.controller';
import { CustomerService } from './customer/customer.service';
import { AssignmentController } from './assignment/assignment.controller';
import { AssignmentService } from './assignment/assignment.service';

@Module({
  imports: [OrganizationModule],
  providers: [BusinessPartnerService, CustomerService, AssignmentService],
  controllers: [BusinessPartnerController, CustomerController, AssignmentController],
})
export class CustomerModule {}
```

- [ ] **Step 8: 빌드 및 전체 테스트 확인**

```bash
cd apps/api && pnpm build && pnpm test
```

Expected: build 성공, 전체 테스트 PASS

- [ ] **Step 9: 커밋**

```bash
git add apps/api/src/customer
git commit -m "feat(customer): add CustomerAssignment CRUD"
```
