# Product + Asset 모듈 설계

## 개요

제품 카탈로그(Product)와 물리적 자산(Asset) 관리 모듈. 자산 상태 변경 이력(AssetEvent)을 읽기 전용 API로 제공한다. MeterReading은 이번 범위에서 제외한다.

---

## 모듈 구조

단일 `ProductModule` 아래 세 개의 서브 도메인을 둔다. CustomerModule과 동일한 패턴.

```
src/product/
├── product.module.ts
├── product/
│   ├── product.controller.ts
│   ├── product.service.ts
│   ├── product.service.spec.ts
│   └── dto/
│       ├── create-product.dto.ts
│       ├── update-product.dto.ts
│       └── query-product.dto.ts
├── asset/
│   ├── asset.controller.ts
│   ├── asset.service.ts
│   ├── asset.service.spec.ts
│   └── dto/
│       ├── create-asset.dto.ts
│       ├── update-asset.dto.ts
│       ├── change-asset-status.dto.ts
│       └── query-asset.dto.ts
└── asset-event/
    ├── asset-event.controller.ts
    ├── asset-event.service.ts
    ├── asset-event.service.spec.ts
    └── dto/
        └── query-asset-event.dto.ts
```

---

## 엔드포인트

모든 엔드포인트는 `OrganizationGuard` + `@OrgCtx()` 적용 (조직 컨텍스트 필수).

### Product

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| `POST` | `/products` | 제품 등록 | 모든 멤버 |
| `GET` | `/products` | 목록 조회 | 모든 멤버 |
| `GET` | `/products/:id` | 상세 조회 (자산 통계 포함) | 모든 멤버 |
| `PATCH` | `/products/:id` | 수정 | 모든 멤버 |
| `DELETE` | `/products/:id` | 소프트 딜리트 | `@Roles('OWNER', 'ADMIN')` |

### Asset

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| `POST` | `/assets` | 자산 등록 | 모든 멤버 |
| `GET` | `/assets` | 목록 조회 | 모든 멤버 |
| `GET` | `/assets/:id` | 상세 조회 | 모든 멤버 |
| `PATCH` | `/assets/:id` | 자산 정보 수정 | 모든 멤버 |
| `PATCH` | `/assets/:id/status` | 수동 상태 변경 | 모든 멤버 |
| `DELETE` | `/assets/:id` | 소프트 딜리트 | `@Roles('OWNER', 'ADMIN')` |

### AssetEvent (읽기 전용)

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| `GET` | `/assets/:id/events` | 자산 상태 변경 이력 조회 | 모든 멤버 |

---

## DTO 명세

### CreateProductDto
```typescript
name: string           // 필수
manufacturer?: string
modelName?: string
category?: string      // 자유 텍스트
memo?: string
```

### UpdateProductDto
`CreateProductDto`의 모든 필드를 optional로 (`PartialType`).

### QueryProductDto
```typescript
category?: string
isActive?: boolean
search?: string   // name 부분 검색
```

### CreateAssetDto
```typescript
productId: string                         // 필수
serialNumber?: string
initialStatus: 'INCOMING' | 'AVAILABLE'   // 필수, 생성 시 선택
purchaseDate?: string   // ISO 날짜
purchasePrice?: number  // 원화 정수
memo?: string
```

### UpdateAssetDto
```typescript
serialNumber?: string
purchaseDate?: string
purchasePrice?: number
memo?: string
// status 변경은 PATCH /assets/:id/status 전용
```

### ChangeAssetStatusDto
```typescript
status: AssetStatus   // 필수
note?: string         // AssetEvent note에 기록
```

### QueryAssetDto
```typescript
productId?: string
status?: AssetStatus
search?: string   // serialNumber 부분 검색
```

### QueryAssetEventDto
```typescript
// 페이지네이션 없이 전체 반환 (이력은 건수가 많지 않음)
```

---

## 비즈니스 로직

### Product 삭제
- `deletedAt IS NULL`인 Asset이 하나라도 있으면 `ConflictException('연결된 자산이 있어 제품을 삭제할 수 없습니다.')`
- 차단되지 않으면 `deletedAt: new Date()`, `isActive: false`

### Product 상세 응답
자산 수 통계를 포함한다:
```typescript
{
  ...product,
  assetStats: {
    total: number,
    byStatus: Record<AssetStatus, number>
  }
}
```

### Asset 생성
1. `productId` + `organizationId`로 Product 존재 확인 (없으면 `NotFoundException`)
2. Product가 `deletedAt != null`이면 `BadRequestException('삭제된 제품에는 자산을 등록할 수 없습니다.')`
3. `serialNumber` 제공 시 `organizationId + serialNumber` 유니크 위반 → `ConflictException`
4. Asset 생성
5. AssetEvent 기록: `fromStatus: null`, `toStatus: initialStatus`, `sourceType: MANUAL`

### Asset 수동 상태 변경 (`PATCH /assets/:id/status`)
1. Asset 조회 (없거나 소프트 딜리트면 `NotFoundException`)
2. `fromStatus === toStatus`이면 no-op (그대로 반환)
3. `$transaction`: Asset status 업데이트 + AssetEvent 기록 (`sourceType: MANUAL`, `sourceId: null`)

### Asset 삭제
- `status === 'RENTED'`이면 `ConflictException('렌탈 중인 자산은 삭제할 수 없습니다.')`
- 차단되지 않으면 `deletedAt: new Date()`

### AssetService.changeStatus() — 내부 API
외부 도메인(렌탈 계약, AS 등)이 자산 상태를 변경할 때 호출하는 내부 메서드:

```typescript
changeStatus(
  assetId: string,
  organizationId: string,
  toStatus: AssetStatus,
  sourceType: AssetEventSourceType,
  sourceId?: string,
  note?: string,
): Promise<void>
```

`ProductModule`에서 `AssetService`를 export해 다른 모듈에서 주입 가능하게 한다.

---

## AssetEvent 기록 규칙

| 상황 | fromStatus | toStatus | sourceType | sourceId |
|------|-----------|---------|-----------|---------|
| Asset 생성 | `null` | `INCOMING` or `AVAILABLE` | `MANUAL` | `null` |
| 수동 상태 변경 | 이전 상태 | 새 상태 | `MANUAL` | `null` |
| 외부 도메인 호출 | 이전 상태 | 새 상태 | 해당 도메인 타입 | 해당 도메인 ID |

AssetEvent는 생성 전용(immutable), 수정/삭제 API 없음.

---

## 범위 밖

- MeterReading — 별도 모듈로 이후에 구현
- Asset 벌크 등록
- 자산 상태 전환 유효성 제약 (예: RENTED → AVAILABLE 불가) — 이번 MVP에서는 제약 없이 모든 전환 허용

---

## 테스트 전략

단위 테스트 (`*.service.spec.ts`):
- `ProductService`: 삭제 차단 (활성 자산 있는 경우 / 없는 경우), 상세 응답의 자산 통계
- `AssetService`: 생성 (삭제된 Product 차단, serialNumber 중복, AssetEvent 기록), 상태 변경 (no-op, 정상 전환, RENTED 삭제 차단)
- `AssetEventService`: 이력 목록 조회

모든 서비스는 Prisma mock 기반 단위 테스트.
