# Product + Asset Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Product(제품) CRUD, Asset(자산) CRUD + 수동 상태 변경, AssetEvent(이력) 읽기 전용 API를 구현한다.

**Architecture:** 단일 `ProductModule` 아래 `product/`, `asset/`, `asset-event/` 세 서브 디렉터리로 분리. 모든 엔드포인트에 `OrganizationGuard`를 적용하고, DELETE만 `@Roles('OWNER', 'ADMIN')`으로 제한. `AssetService`는 `ProductModule`에서 export해 추후 렌탈/AS 모듈이 상태 변경 내부 API를 주입받아 사용.

**Tech Stack:** NestJS 11, Prisma 7 (`@prisma/adapter-pg`), class-validator 0.15, class-transformer 0.5

## Global Constraints

- 작업 전 반드시 `develop`에서 `feature/api/product` 브랜치를 생성한 뒤 작업
- 모든 파일 경로는 `apps/api/src/` 기준
- 들여쓰기: 2칸 space, single quote, trailing comma (prettier.config.mjs 기준)
- 테스트 명령: `pnpm test` (from `apps/api/`)
- 커밋 메시지에 `Co-Authored-By` 트레일러 추가 금지
- `PrismaModule`은 `@Global()` — 별도 import 없이 `PrismaService` 주입 가능
- `OrganizationModule`이 `OrganizationGuard`를 export — `ProductModule`에서 import
- `AssetService.changeStatus()` 시그니처는 정확히 다음과 같이 유지 (외부 모듈이 의존):
  `changeStatus(assetId: string, organizationId: string, toStatus: AssetStatus, sourceType: AssetEventSourceType, sourceId?: string, note?: string): Promise<void>`
- 소프트 딜리트: Asset은 `deletedAt: new Date()`만 설정 (isActive 없음); Product는 `deletedAt: new Date(), isActive: false` 함께 설정
- 컨트롤러 가드 순서: `@UseGuards(JwtAuthGuard, OrganizationGuard)` — `JwtAuthGuard` 먼저

---

## File Map

```
src/product/
├── product.module.ts                                    (T1에서 생성, T2에서 수정)
├── product/
│   ├── product.controller.ts                           (T1)
│   ├── product.service.ts                              (T1)
│   ├── product.service.spec.ts                         (T1)
│   └── dto/
│       ├── create-product.dto.ts                       (T1)
│       ├── update-product.dto.ts                       (T1)
│       └── query-product.dto.ts                        (T1)
├── asset/
│   ├── asset.controller.ts                             (T2)
│   ├── asset.service.ts                                (T2)
│   ├── asset.service.spec.ts                           (T2)
│   └── dto/
│       ├── create-asset.dto.ts                         (T2)
│       ├── update-asset.dto.ts                         (T2)
│       ├── change-asset-status.dto.ts                  (T2)
│       └── query-asset.dto.ts                          (T2)
└── asset-event/
    ├── asset-event.controller.ts                       (T2)
    ├── asset-event.service.ts                          (T2)
    ├── asset-event.service.spec.ts                     (T2)
    └── dto/
        └── query-asset-event.dto.ts                    (T2)

src/app.module.ts                                        (T1에서 ProductModule 등록)
```

---

## Task 1: ProductModule + Product CRUD

**Files:**
- Create: `src/product/product.module.ts`
- Create: `src/product/product/dto/create-product.dto.ts`
- Create: `src/product/product/dto/update-product.dto.ts`
- Create: `src/product/product/dto/query-product.dto.ts`
- Create: `src/product/product/product.service.ts`
- Create: `src/product/product/product.service.spec.ts`
- Create: `src/product/product/product.controller.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- Produces:
  - `ProductService.create(organizationId: string, dto: CreateProductDto): Promise<{ id: string }>`
  - `ProductService.findAll(organizationId: string, query: QueryProductDto): Promise<Product[]>`
  - `ProductService.findOne(organizationId: string, id: string): Promise<Product & { assetStats: { total: number; byStatus: Record<string, number> } }>`
  - `ProductService.update(organizationId: string, id: string, dto: UpdateProductDto): Promise<void>`
  - `ProductService.softDelete(organizationId: string, id: string): Promise<void>`

---

- [ ] **Step 1: 브랜치 생성**

```bash
cd apps/api
git checkout develop && git pull
git checkout -b feature/api/product
```

- [ ] **Step 2: DTO 파일 작성**

`src/product/product/dto/create-product.dto.ts`:
```typescript
import { IsOptional, IsString } from 'class-validator';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  memo?: string;
}
```

`src/product/product/dto/update-product.dto.ts`:
```typescript
import { IsOptional, IsString } from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  memo?: string;
}
```

`src/product/product/dto/query-product.dto.ts`:
```typescript
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class QueryProductDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  search?: string;
}
```

- [ ] **Step 3: ProductService 실패 테스트 작성**

`src/product/product/product.service.spec.ts`:
```typescript
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductService } from './product.service';

describe('ProductService', () => {
  let service: ProductService;
  let prisma: {
    product: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    asset: { count: jest.Mock; groupBy: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      product: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      asset: {
        count: jest.fn(),
        groupBy: jest.fn(),
      },
    };
    const module = await Test.createTestingModule({
      providers: [ProductService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ProductService);
  });

  describe('create', () => {
    it('creates product and returns id', async () => {
      prisma.product.create.mockResolvedValue({ id: 'prod-1' });
      const result = await service.create('org-1', { name: '복합기 A' });
      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org-1', name: '복합기 A' }) }),
      );
      expect(result).toEqual({ id: 'prod-1' });
    });
  });

  describe('findAll', () => {
    it('returns products filtered by category', async () => {
      prisma.product.findMany.mockResolvedValue([{ id: 'prod-1' }]);
      const result = await service.findAll('org-1', { category: '복합기' });
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1', deletedAt: null, category: '복합기' }),
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('filters by isActive=false', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      await service.findAll('org-1', { isActive: false });
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isActive: false }) }),
      );
    });

    it('filters by search term (name contains)', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      await service.findAll('org-1', { search: 'A4' });
      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ name: { contains: 'A4' } }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.findOne('org-1', 'prod-x')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when soft-deleted', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', deletedAt: new Date() });
      await expect(service.findOne('org-1', 'prod-1')).rejects.toThrow(NotFoundException);
    });

    it('returns product with asset stats', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', name: '복합기 A', deletedAt: null });
      prisma.asset.groupBy.mockResolvedValue([
        { status: 'AVAILABLE', _count: { status: 2 } },
        { status: 'RENTED', _count: { status: 1 } },
      ]);
      const result = await service.findOne('org-1', 'prod-1');
      expect(result.assetStats).toEqual({ total: 3, byStatus: { AVAILABLE: 2, RENTED: 1 } });
    });

    it('returns empty assetStats when no assets', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', deletedAt: null });
      prisma.asset.groupBy.mockResolvedValue([]);
      const result = await service.findOne('org-1', 'prod-1');
      expect(result.assetStats).toEqual({ total: 0, byStatus: {} });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.update('org-1', 'prod-x', { name: '신제품' })).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when soft-deleted', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', deletedAt: new Date() });
      await expect(service.update('org-1', 'prod-1', { name: '신제품' })).rejects.toThrow(NotFoundException);
    });

    it('updates product fields', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', deletedAt: null });
      prisma.product.update.mockResolvedValue({});
      await service.update('org-1', 'prod-1', { name: '신제품', category: '프린터' });
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id_organizationId: { id: 'prod-1', organizationId: 'org-1' } },
          data: expect.objectContaining({ name: '신제품', category: '프린터' }),
        }),
      );
    });
  });

  describe('softDelete', () => {
    it('throws NotFoundException when product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.softDelete('org-1', 'prod-x')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when already soft-deleted', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', deletedAt: new Date() });
      await expect(service.softDelete('org-1', 'prod-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when active assets exist', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', deletedAt: null });
      prisma.asset.count.mockResolvedValue(3);
      await expect(service.softDelete('org-1', 'prod-1')).rejects.toThrow(ConflictException);
    });

    it('soft-deletes product when no active assets', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', deletedAt: null });
      prisma.asset.count.mockResolvedValue(0);
      prisma.product.update.mockResolvedValue({});
      await service.softDelete('org-1', 'prod-1');
      expect(prisma.product.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) }),
        }),
      );
    });
  });
});
```

- [ ] **Step 4: 테스트 실패 확인**

```bash
cd apps/api && pnpm test -- src/product/product/product.service.spec.ts
```

Expected: FAIL (ProductService not found)

- [ ] **Step 5: ProductService 구현**

`src/product/product/product.service.ts`:
```typescript
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateProductDto } from './dto/create-product.dto';
import type { UpdateProductDto } from './dto/update-product.dto';
import type { QueryProductDto } from './dto/query-product.dto';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateProductDto): Promise<{ id: string }> {
    const product = await this.prisma.product.create({
      data: { organizationId, ...dto },
    });
    return { id: product.id };
  }

  async findAll(organizationId: string, query: QueryProductDto) {
    const { category, isActive, search } = query;
    return this.prisma.product.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(category && { category }),
        ...(isActive !== undefined && { isActive }),
        ...(search && { name: { contains: search } }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id_organizationId: { id, organizationId } },
    });
    if (!product || product.deletedAt) throw new NotFoundException('제품을 찾을 수 없습니다.');

    const statusCounts = await this.prisma.asset.groupBy({
      by: ['status'],
      where: { productId: id, organizationId, deletedAt: null },
      _count: { status: true },
    });
    const total = statusCounts.reduce((s, r) => s + r._count.status, 0);
    const byStatus = Object.fromEntries(statusCounts.map((r) => [r.status, r._count.status]));

    return { ...product, assetStats: { total, byStatus } };
  }

  async update(organizationId: string, id: string, dto: UpdateProductDto): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!product || product.deletedAt) throw new NotFoundException('제품을 찾을 수 없습니다.');
    await this.prisma.product.update({
      where: { id_organizationId: { id, organizationId } },
      data: dto,
    });
  }

  async softDelete(organizationId: string, id: string): Promise<void> {
    const product = await this.prisma.product.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!product || product.deletedAt) throw new NotFoundException('제품을 찾을 수 없습니다.');

    const assetCount = await this.prisma.asset.count({
      where: { productId: id, organizationId, deletedAt: null },
    });
    if (assetCount > 0) throw new ConflictException('연결된 자산이 있어 제품을 삭제할 수 없습니다.');

    await this.prisma.product.update({
      where: { id_organizationId: { id, organizationId } },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
cd apps/api && pnpm test -- src/product/product/product.service.spec.ts
```

Expected: PASS (모든 테스트 통과)

- [ ] **Step 7: ProductController 작성**

`src/product/product/product.controller.ts`:
```typescript
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';

@ApiTags('products')
@Controller('products')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class ProductController {
  constructor(private readonly service: ProductService) {}

  @Get()
  async findAll(@Query() query: QueryProductDto, @OrgCtx() ctx: OrgContext) {
    return this.service.findAll(ctx.organizationId, query);
  }

  @Post()
  async create(@Body() dto: CreateProductDto, @OrgCtx() ctx: OrgContext) {
    return this.service.create(ctx.organizationId, dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.findOne(ctx.organizationId, id);
  }

  @Patch(':id')
  @HttpCode(200)
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto, @OrgCtx() ctx: OrgContext) {
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

- [ ] **Step 8: ProductModule 생성 및 app.module.ts 수정**

`src/product/product.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { ProductController } from './product/product.controller';
import { ProductService } from './product/product.service';

@Module({
  imports: [OrganizationModule],
  providers: [ProductService],
  controllers: [ProductController],
})
export class ProductModule {}
```

`src/app.module.ts` — `ProductModule` import 추가:
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { CustomerModule } from './customer/customer.module';
import { MailModule } from './mail/mail.module';
import { OrganizationModule } from './organization/organization.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductModule } from './product/product.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    PrismaModule,
    MailModule,
    AuthModule,
    OrganizationModule,
    CustomerModule,
    ProductModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
```

- [ ] **Step 9: 전체 테스트 통과 확인**

```bash
cd apps/api && pnpm test
```

Expected: PASS (기존 테스트 포함 전체 통과)

- [ ] **Step 10: 커밋**

```bash
git add src/product/product.module.ts \
  src/product/product/product.controller.ts \
  src/product/product/product.service.ts \
  src/product/product/product.service.spec.ts \
  src/product/product/dto/create-product.dto.ts \
  src/product/product/dto/update-product.dto.ts \
  src/product/product/dto/query-product.dto.ts \
  src/app.module.ts
git commit -m "feat(product): Add ProductModule with Product CRUD"
```

---

## Task 2: Asset CRUD + AssetEvent 읽기 + ProductModule 완성

**Files:**
- Create: `src/product/asset/dto/create-asset.dto.ts`
- Create: `src/product/asset/dto/update-asset.dto.ts`
- Create: `src/product/asset/dto/change-asset-status.dto.ts`
- Create: `src/product/asset/dto/query-asset.dto.ts`
- Create: `src/product/asset/asset.service.ts`
- Create: `src/product/asset/asset.service.spec.ts`
- Create: `src/product/asset/asset.controller.ts`
- Create: `src/product/asset-event/dto/query-asset-event.dto.ts`
- Create: `src/product/asset-event/asset-event.service.ts`
- Create: `src/product/asset-event/asset-event.service.spec.ts`
- Create: `src/product/asset-event/asset-event.controller.ts`
- Modify: `src/product/product.module.ts`

**Interfaces:**
- Consumes (from T1):
  - `ProductModule` (for OrganizationModule re-use)
- Produces:
  - `AssetService.create(organizationId: string, dto: CreateAssetDto): Promise<{ id: string }>`
  - `AssetService.findAll(organizationId: string, query: QueryAssetDto): Promise<Asset[]>`
  - `AssetService.findOne(organizationId: string, id: string): Promise<Asset>`
  - `AssetService.update(organizationId: string, id: string, dto: UpdateAssetDto): Promise<void>`
  - `AssetService.changeStatus(assetId: string, organizationId: string, toStatus: AssetStatus, sourceType: AssetEventSourceType, sourceId?: string, note?: string): Promise<void>` ← **이 시그니처 정확히 유지**
  - `AssetService.softDelete(organizationId: string, id: string): Promise<void>`
  - `AssetEventService.findByAsset(organizationId: string, assetId: string): Promise<AssetEvent[]>`

---

- [ ] **Step 1: Asset DTO 작성**

`src/product/asset/dto/create-asset.dto.ts`:
```typescript
import { IsInt, IsISO8601, IsOptional, IsString, IsIn } from 'class-validator';

export class CreateAssetDto {
  @IsString()
  productId: string;

  @IsIn(['INCOMING', 'AVAILABLE'])
  initialStatus: 'INCOMING' | 'AVAILABLE';

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsISO8601()
  purchaseDate?: string;

  @IsOptional()
  @IsInt()
  purchasePrice?: number;

  @IsOptional()
  @IsString()
  memo?: string;
}
```

`src/product/asset/dto/update-asset.dto.ts`:
```typescript
import { IsInt, IsISO8601, IsOptional, IsString } from 'class-validator';

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsISO8601()
  purchaseDate?: string;

  @IsOptional()
  @IsInt()
  purchasePrice?: number;

  @IsOptional()
  @IsString()
  memo?: string;
}
```

`src/product/asset/dto/change-asset-status.dto.ts`:
```typescript
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AssetStatus } from '@prisma/client';

export class ChangeAssetStatusDto {
  @IsEnum(AssetStatus)
  status: AssetStatus;

  @IsOptional()
  @IsString()
  note?: string;
}
```

`src/product/asset/dto/query-asset.dto.ts`:
```typescript
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { AssetStatus } from '@prisma/client';

export class QueryAssetDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
```

`src/product/asset-event/dto/query-asset-event.dto.ts`:
```typescript
export class QueryAssetEventDto {}
```

- [ ] **Step 2: AssetService 실패 테스트 작성**

`src/product/asset/asset.service.spec.ts`:
```typescript
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetService } from './asset.service';

describe('AssetService', () => {
  let service: AssetService;
  let prisma: {
    $transaction: jest.Mock;
    product: { findUnique: jest.Mock };
    asset: { create: jest.Mock; findUnique: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    assetEvent: { create: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn().mockImplementation((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
      product: { findUnique: jest.fn() },
      asset: { create: jest.fn(), findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      assetEvent: { create: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [AssetService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AssetService);
  });

  describe('create', () => {
    it('throws NotFoundException when product not found', async () => {
      prisma.product.findUnique.mockResolvedValue(null);
      await expect(service.create('org-1', { productId: 'p-x', initialStatus: 'AVAILABLE' })).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when product is deleted', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p-1', deletedAt: new Date() });
      await expect(service.create('org-1', { productId: 'p-1', initialStatus: 'AVAILABLE' })).rejects.toThrow(BadRequestException);
    });

    it('creates asset and AssetEvent in transaction', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p-1', deletedAt: null });
      prisma.asset.create.mockResolvedValue({ id: 'asset-1' });
      prisma.assetEvent.create.mockResolvedValue({});

      const result = await service.create('org-1', { productId: 'p-1', initialStatus: 'AVAILABLE' });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ organizationId: 'org-1', productId: 'p-1', status: 'AVAILABLE' }),
        }),
      );
      expect(prisma.assetEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fromStatus: null, toStatus: 'AVAILABLE', sourceType: 'MANUAL' }),
        }),
      );
      expect(result).toEqual({ id: 'asset-1' });
    });

    it('creates asset with INCOMING status', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p-1', deletedAt: null });
      prisma.asset.create.mockResolvedValue({ id: 'asset-2' });
      prisma.assetEvent.create.mockResolvedValue({});

      await service.create('org-1', { productId: 'p-1', initialStatus: 'INCOMING', serialNumber: 'SN-001' });

      expect(prisma.asset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'INCOMING', serialNumber: 'SN-001' }),
        }),
      );
      expect(prisma.assetEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fromStatus: null, toStatus: 'INCOMING' }),
        }),
      );
    });

    it('throws ConflictException on duplicate serialNumber (P2002)', async () => {
      prisma.product.findUnique.mockResolvedValue({ id: 'p-1', deletedAt: null });
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint violation', {
        code: 'P2002',
        clientVersion: '7.0.0',
      });
      prisma.$transaction.mockRejectedValue(p2002);
      await expect(
        service.create('org-1', { productId: 'p-1', initialStatus: 'AVAILABLE', serialNumber: 'SN-DUPE' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('returns assets filtered by productId and status', async () => {
      prisma.asset.findMany.mockResolvedValue([{ id: 'a-1' }]);
      await service.findAll('org-1', { productId: 'p-1', status: 'AVAILABLE' });
      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: 'org-1', productId: 'p-1', status: 'AVAILABLE', deletedAt: null }),
        }),
      );
    });

    it('filters by serialNumber search', async () => {
      prisma.asset.findMany.mockResolvedValue([]);
      await service.findAll('org-1', { search: 'SN-00' });
      expect(prisma.asset.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ serialNumber: { contains: 'SN-00' } }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when not found', async () => {
      prisma.asset.findUnique.mockResolvedValue(null);
      await expect(service.findOne('org-1', 'asset-x')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when soft-deleted', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', deletedAt: new Date() });
      await expect(service.findOne('org-1', 'a-1')).rejects.toThrow(NotFoundException);
    });

    it('returns asset with product info', async () => {
      prisma.asset.findUnique.mockResolvedValue({
        id: 'a-1', deletedAt: null, product: { id: 'p-1', name: '복합기 A' },
      });
      const result = await service.findOne('org-1', 'a-1');
      expect(result).toMatchObject({ id: 'a-1' });
    });
  });

  describe('update', () => {
    it('throws NotFoundException when not found', async () => {
      prisma.asset.findUnique.mockResolvedValue(null);
      await expect(service.update('org-1', 'a-x', { memo: '...' })).rejects.toThrow(NotFoundException);
    });

    it('updates asset fields', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', deletedAt: null });
      prisma.asset.update.mockResolvedValue({});
      await service.update('org-1', 'a-1', { memo: '새 메모' });
      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ memo: '새 메모' }) }),
      );
    });

    it('throws ConflictException on duplicate serialNumber (P2002)', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', deletedAt: null });
      const p2002 = new Prisma.PrismaClientKnownRequestError('Unique constraint violation', {
        code: 'P2002',
        clientVersion: '7.0.0',
      });
      prisma.asset.update.mockRejectedValue(p2002);
      await expect(service.update('org-1', 'a-1', { serialNumber: 'SN-DUPE' })).rejects.toThrow(ConflictException);
    });
  });

  describe('changeStatus', () => {
    it('throws NotFoundException when asset not found', async () => {
      prisma.asset.findUnique.mockResolvedValue(null);
      await expect(service.changeStatus('a-x', 'org-1', 'REPAIR', 'MANUAL')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when soft-deleted', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', status: 'AVAILABLE', deletedAt: new Date() });
      await expect(service.changeStatus('a-1', 'org-1', 'REPAIR', 'MANUAL')).rejects.toThrow(NotFoundException);
    });

    it('no-op when status is same (does not call $transaction)', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', status: 'AVAILABLE', deletedAt: null });
      await service.changeStatus('a-1', 'org-1', 'AVAILABLE', 'MANUAL');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('updates status and creates AssetEvent in transaction', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', status: 'AVAILABLE', deletedAt: null });
      prisma.asset.update.mockResolvedValue({});
      prisma.assetEvent.create.mockResolvedValue({});

      await service.changeStatus('a-1', 'org-1', 'REPAIR', 'MANUAL', undefined, '수리 요청');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id_organizationId: { id: 'a-1', organizationId: 'org-1' } },
          data: { status: 'REPAIR' },
        }),
      );
      expect(prisma.assetEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            fromStatus: 'AVAILABLE',
            toStatus: 'REPAIR',
            sourceType: 'MANUAL',
            note: '수리 요청',
          }),
        }),
      );
    });

    it('passes sourceType and sourceId for non-MANUAL source', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', status: 'AVAILABLE', deletedAt: null });
      prisma.asset.update.mockResolvedValue({});
      prisma.assetEvent.create.mockResolvedValue({});

      await service.changeStatus('a-1', 'org-1', 'RENTED', 'RENTAL_CONTRACT', 'contract-123');

      expect(prisma.assetEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sourceType: 'RENTAL_CONTRACT', sourceId: 'contract-123' }),
        }),
      );
    });
  });

  describe('softDelete', () => {
    it('throws NotFoundException when not found', async () => {
      prisma.asset.findUnique.mockResolvedValue(null);
      await expect(service.softDelete('org-1', 'a-x')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when already deleted', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', status: 'AVAILABLE', deletedAt: new Date() });
      await expect(service.softDelete('org-1', 'a-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when status is RENTED', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', status: 'RENTED', deletedAt: null });
      await expect(service.softDelete('org-1', 'a-1')).rejects.toThrow(ConflictException);
    });

    it('soft-deletes asset (sets deletedAt only)', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', status: 'AVAILABLE', deletedAt: null });
      prisma.asset.update.mockResolvedValue({});
      await service.softDelete('org-1', 'a-1');
      expect(prisma.asset.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { deletedAt: expect.any(Date) },
        }),
      );
    });
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

```bash
cd apps/api && pnpm test -- src/product/asset/asset.service.spec.ts
```

Expected: FAIL (AssetService not found)

- [ ] **Step 4: AssetService 구현**

`src/product/asset/asset.service.ts`:
```typescript
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetEventSourceType, AssetStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateAssetDto } from './dto/create-asset.dto';
import type { UpdateAssetDto } from './dto/update-asset.dto';
import type { QueryAssetDto } from './dto/query-asset.dto';

@Injectable()
export class AssetService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateAssetDto): Promise<{ id: string }> {
    const product = await this.prisma.product.findUnique({
      where: { id_organizationId: { id: dto.productId, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!product) throw new NotFoundException('제품을 찾을 수 없습니다.');
    if (product.deletedAt) throw new BadRequestException('삭제된 제품에는 자산을 등록할 수 없습니다.');

    try {
      const asset = await this.prisma.$transaction(async (tx) => {
        const created = await tx.asset.create({
          data: {
            organizationId,
            productId: dto.productId,
            serialNumber: dto.serialNumber,
            status: dto.initialStatus,
            purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : undefined,
            purchasePrice: dto.purchasePrice,
            memo: dto.memo,
          },
        });
        await tx.assetEvent.create({
          data: {
            organizationId,
            assetId: created.id,
            fromStatus: null,
            toStatus: dto.initialStatus,
            sourceType: AssetEventSourceType.MANUAL,
          },
        });
        return created;
      });
      return { id: asset.id };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('이미 등록된 시리얼 번호입니다.');
      }
      throw e;
    }
  }

  async findAll(organizationId: string, query: QueryAssetDto) {
    const { productId, status, search } = query;
    return this.prisma.asset.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(productId && { productId }),
        ...(status && { status }),
        ...(search && { serialNumber: { contains: search } }),
      },
      include: {
        product: { select: { id: true, name: true, manufacturer: true, modelName: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id_organizationId: { id, organizationId } },
      include: {
        product: { select: { id: true, name: true, manufacturer: true, modelName: true, category: true } },
      },
    });
    if (!asset || asset.deletedAt) throw new NotFoundException('자산을 찾을 수 없습니다.');
    return asset;
  }

  async update(organizationId: string, id: string, dto: UpdateAssetDto): Promise<void> {
    const asset = await this.prisma.asset.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!asset || asset.deletedAt) throw new NotFoundException('자산을 찾을 수 없습니다.');
    try {
      await this.prisma.asset.update({
        where: { id_organizationId: { id, organizationId } },
        data: {
          ...(dto.serialNumber !== undefined && { serialNumber: dto.serialNumber }),
          ...(dto.purchaseDate !== undefined && { purchaseDate: new Date(dto.purchaseDate) }),
          ...(dto.purchasePrice !== undefined && { purchasePrice: dto.purchasePrice }),
          ...(dto.memo !== undefined && { memo: dto.memo }),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('이미 등록된 시리얼 번호입니다.');
      }
      throw e;
    }
  }

  async changeStatus(
    assetId: string,
    organizationId: string,
    toStatus: AssetStatus,
    sourceType: AssetEventSourceType,
    sourceId?: string,
    note?: string,
  ): Promise<void> {
    const asset = await this.prisma.asset.findUnique({
      where: { id_organizationId: { id: assetId, organizationId } },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!asset || asset.deletedAt) throw new NotFoundException('자산을 찾을 수 없습니다.');
    if (asset.status === toStatus) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.asset.update({
        where: { id_organizationId: { id: assetId, organizationId } },
        data: { status: toStatus },
      });
      await tx.assetEvent.create({
        data: {
          organizationId,
          assetId,
          fromStatus: asset.status,
          toStatus,
          sourceType,
          sourceId,
          note,
        },
      });
    });
  }

  async softDelete(organizationId: string, id: string): Promise<void> {
    const asset = await this.prisma.asset.findUnique({
      where: { id_organizationId: { id, organizationId } },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!asset || asset.deletedAt) throw new NotFoundException('자산을 찾을 수 없습니다.');
    if (asset.status === AssetStatus.RENTED) throw new ConflictException('렌탈 중인 자산은 삭제할 수 없습니다.');
    await this.prisma.asset.update({
      where: { id_organizationId: { id, organizationId } },
      data: { deletedAt: new Date() },
    });
  }
}
```

- [ ] **Step 5: AssetService 테스트 통과 확인**

```bash
cd apps/api && pnpm test -- src/product/asset/asset.service.spec.ts
```

Expected: PASS

- [ ] **Step 6: AssetEventService 실패 테스트 작성**

`src/product/asset-event/asset-event.service.spec.ts`:
```typescript
import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { AssetEventService } from './asset-event.service';

describe('AssetEventService', () => {
  let service: AssetEventService;
  let prisma: {
    asset: { findUnique: jest.Mock };
    assetEvent: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      asset: { findUnique: jest.fn() },
      assetEvent: { findMany: jest.fn() },
    };
    const module = await Test.createTestingModule({
      providers: [AssetEventService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(AssetEventService);
  });

  describe('findByAsset', () => {
    it('throws NotFoundException when asset not found', async () => {
      prisma.asset.findUnique.mockResolvedValue(null);
      await expect(service.findByAsset('org-1', 'a-x')).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when asset is soft-deleted', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', deletedAt: new Date() });
      await expect(service.findByAsset('org-1', 'a-1')).rejects.toThrow(NotFoundException);
    });

    it('returns events ordered by createdAt desc', async () => {
      prisma.asset.findUnique.mockResolvedValue({ id: 'a-1', deletedAt: null });
      prisma.assetEvent.findMany.mockResolvedValue([
        { id: 'ev-2', toStatus: 'REPAIR', createdAt: new Date('2026-06-23T10:00:00Z') },
        { id: 'ev-1', toStatus: 'AVAILABLE', createdAt: new Date('2026-06-23T09:00:00Z') },
      ]);
      const result = await service.findByAsset('org-1', 'a-1');
      expect(prisma.assetEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { assetId: 'a-1', organizationId: 'org-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toHaveLength(2);
    });
  });
});
```

- [ ] **Step 7: 테스트 실패 확인**

```bash
cd apps/api && pnpm test -- src/product/asset-event/asset-event.service.spec.ts
```

Expected: FAIL (AssetEventService not found)

- [ ] **Step 8: AssetEventService 구현**

`src/product/asset-event/asset-event.service.ts`:
```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AssetEventService {
  constructor(private readonly prisma: PrismaService) {}

  async findByAsset(organizationId: string, assetId: string) {
    const asset = await this.prisma.asset.findUnique({
      where: { id_organizationId: { id: assetId, organizationId } },
      select: { id: true, deletedAt: true },
    });
    if (!asset || asset.deletedAt) throw new NotFoundException('자산을 찾을 수 없습니다.');

    return this.prisma.assetEvent.findMany({
      where: { assetId, organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

- [ ] **Step 9: AssetEventService 테스트 통과 확인**

```bash
cd apps/api && pnpm test -- src/product/asset-event/asset-event.service.spec.ts
```

Expected: PASS

- [ ] **Step 10: 컨트롤러 작성**

`src/product/asset/asset.controller.ts`:
```typescript
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AssetEventSourceType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AssetService } from './asset.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { ChangeAssetStatusDto } from './dto/change-asset-status.dto';
import { QueryAssetDto } from './dto/query-asset.dto';

@ApiTags('assets')
@Controller('assets')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class AssetController {
  constructor(private readonly service: AssetService) {}

  @Get()
  async findAll(@Query() query: QueryAssetDto, @OrgCtx() ctx: OrgContext) {
    return this.service.findAll(ctx.organizationId, query);
  }

  @Post()
  async create(@Body() dto: CreateAssetDto, @OrgCtx() ctx: OrgContext) {
    return this.service.create(ctx.organizationId, dto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.findOne(ctx.organizationId, id);
  }

  @Patch(':id')
  @HttpCode(200)
  async update(@Param('id') id: string, @Body() dto: UpdateAssetDto, @OrgCtx() ctx: OrgContext) {
    return this.service.update(ctx.organizationId, id, dto);
  }

  @Patch(':id/status')
  @HttpCode(200)
  async changeStatus(@Param('id') id: string, @Body() dto: ChangeAssetStatusDto, @OrgCtx() ctx: OrgContext) {
    return this.service.changeStatus(id, ctx.organizationId, dto.status, AssetEventSourceType.MANUAL, undefined, dto.note);
  }

  @Delete(':id')
  @HttpCode(200)
  @Roles('OWNER', 'ADMIN')
  async softDelete(@Param('id') id: string, @OrgCtx() ctx: OrgContext) {
    return this.service.softDelete(ctx.organizationId, id);
  }
}
```

`src/product/asset-event/asset-event.controller.ts`:
```typescript
import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/core/jwt-auth.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import type { OrgContext } from '../../common/guards/organization.guard';
import { OrgCtx } from '../../common/decorators/org-context.decorator';
import { AssetEventService } from './asset-event.service';

@ApiTags('assets')
@Controller('assets')
@UseGuards(JwtAuthGuard, OrganizationGuard)
export class AssetEventController {
  constructor(private readonly service: AssetEventService) {}

  @Get(':assetId/events')
  async findByAsset(@Param('assetId') assetId: string, @OrgCtx() ctx: OrgContext) {
    return this.service.findByAsset(ctx.organizationId, assetId);
  }
}
```

- [ ] **Step 11: ProductModule 업데이트 (Asset + AssetEvent 등록, AssetService export)**

`src/product/product.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { ProductController } from './product/product.controller';
import { ProductService } from './product/product.service';
import { AssetController } from './asset/asset.controller';
import { AssetService } from './asset/asset.service';
import { AssetEventController } from './asset-event/asset-event.controller';
import { AssetEventService } from './asset-event/asset-event.service';

@Module({
  imports: [OrganizationModule],
  providers: [ProductService, AssetService, AssetEventService],
  controllers: [ProductController, AssetController, AssetEventController],
  exports: [AssetService],
})
export class ProductModule {}
```

- [ ] **Step 12: 전체 테스트 통과 확인**

```bash
cd apps/api && pnpm test
```

Expected: PASS (기존 테스트 포함 전체 통과)

- [ ] **Step 13: 커밋**

```bash
git add \
  src/product/asset/asset.controller.ts \
  src/product/asset/asset.service.ts \
  src/product/asset/asset.service.spec.ts \
  src/product/asset/dto/create-asset.dto.ts \
  src/product/asset/dto/update-asset.dto.ts \
  src/product/asset/dto/change-asset-status.dto.ts \
  src/product/asset/dto/query-asset.dto.ts \
  src/product/asset-event/asset-event.controller.ts \
  src/product/asset-event/asset-event.service.ts \
  src/product/asset-event/asset-event.service.spec.ts \
  src/product/asset-event/dto/query-asset-event.dto.ts \
  src/product/product.module.ts
git commit -m "feat(product): Add Asset CRUD, status change, and AssetEvent read API"
```
