# Order 모듈 영역 1 설계 — Quotation + Order (Sale/Rental 생성)

## 개요

견적서(Quotation) CRUD 및 상태 관리, 견적 → 주문 변환, 판매/렌탈 주문(Order) 직접 생성 및 항목 관리를 구현한다. RentalContract 계약 관리는 영역 2에서 별도 구현한다.

---

## 모듈 구조

단일 `OrderModule` 아래 4개 서브 도메인 + 공통 서비스.

```
src/order/
├── order.module.ts
├── common/
│   └── document-sequence.service.ts
├── quotation/
│   ├── quotation.controller.ts
│   ├── quotation.service.ts
│   ├── quotation.service.spec.ts
│   └── dto/
│       ├── create-quotation.dto.ts
│       ├── update-quotation.dto.ts
│       ├── query-quotation.dto.ts
│       ├── update-quotation-status.dto.ts
│       ├── convert-quotation.dto.ts
│       ├── create-quotation-item.dto.ts
│       └── update-quotation-item.dto.ts
├── order/
│   ├── order.controller.ts
│   ├── order.service.ts
│   ├── order.service.spec.ts
│   └── dto/
│       ├── create-order.dto.ts
│       ├── update-order.dto.ts
│       ├── query-order.dto.ts
│       └── update-order-status.dto.ts
├── sale-order/
│   ├── sale-order.service.ts
│   ├── sale-order.service.spec.ts
│   ├── sale-order.controller.ts
│   └── dto/
│       ├── create-sale-order-item.dto.ts
│       └── update-sale-order-item.dto.ts
└── rental-order/
    ├── rental-order.service.ts
    ├── rental-order.service.spec.ts
    ├── rental-order.controller.ts
    └── dto/
        ├── create-rental-order-item.dto.ts
        └── update-rental-order-item.dto.ts
```

`DocumentSequenceService`는 `OrderModule` 내부 전용. 추후 다른 모듈에서도 필요하면 `CommonModule`로 이동.

---

## 엔드포인트

모든 엔드포인트는 `OrganizationGuard` + `@OrgCtx()` 적용. DELETE는 `@Roles('OWNER', 'ADMIN')`.

### Quotation

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/quotations` | 견적 등록 (항목 포함) |
| `GET` | `/quotations` | 목록 (필터: type, status, customerId) |
| `GET` | `/quotations/:id` | 상세 |
| `PATCH` | `/quotations/:id` | 기본 정보 수정 |
| `DELETE` | `/quotations/:id` | 삭제 (DRAFT만 가능) |
| `PATCH` | `/quotations/:id/status` | 상태 전환 |
| `POST` | `/quotations/:id/convert` | Order로 변환 |
| `POST` | `/quotations/:id/items` | 항목 추가 |
| `PATCH` | `/quotations/:id/items/:itemId` | 항목 수정 |
| `DELETE` | `/quotations/:id/items/:itemId` | 항목 삭제 |

### Order

| Method | Path | 설명 |
|--------|------|------|
| `POST` | `/orders` | 주문 직접 생성 (type: SALE\|RENTAL, 항목 포함) |
| `GET` | `/orders` | 목록 (필터: type, status, customerId) |
| `GET` | `/orders/:id` | 상세 (SaleOrder 또는 RentalOrder 포함) |
| `PATCH` | `/orders/:id` | 기본 정보 수정 |
| `PATCH` | `/orders/:id/status` | 상태 전환 |
| `DELETE` | `/orders/:id` | 취소 (REGISTERED만 가능) |
| `POST` | `/orders/:id/sale-items` | 판매 항목 추가 |
| `PATCH` | `/orders/:id/sale-items/:itemId` | 판매 항목 수정 |
| `DELETE` | `/orders/:id/sale-items/:itemId` | 판매 항목 삭제 |
| `POST` | `/orders/:id/rental-items` | 렌탈 항목 추가 |
| `PATCH` | `/orders/:id/rental-items/:itemId` | 렌탈 항목 수정 |
| `DELETE` | `/orders/:id/rental-items/:itemId` | 렌탈 항목 삭제 |

---

## DTO 명세

### CreateQuotationDto
```typescript
type: QuotationType              // 필수 (SALE | RENTAL)
customerId: string               // 필수
validUntil?: string              // ISO 날짜
memo?: string
items: CreateQuotationItemDto[]  // 필수, 최소 1개
```

### CreateQuotationItemDto
```typescript
productId: string    // 필수
assetId?: string     // 선택 (특정 장비 지정)
description?: string
quantity: number     // 필수, 최소 1
unitPrice: number    // 필수, 최소 0
vatType: VatType     // 필수 (INCLUDED | NONE)
// 렌탈 견적인 경우
monthlyRentalPrice?: number
contractMonths?: number
depositAmount?: number
memo?: string
```

### UpdateQuotationStatusDto
```typescript
status: 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'  // 필수
```

### ConvertQuotationDto
```typescript
managerId?: string
orderDate?: string          // ISO 날짜, 기본값: 오늘
memo?: string
items?: ConvertQuotationItemOverrideDto[]  // 선택 — 오버라이드할 항목만 포함
```

### ConvertQuotationItemOverrideDto
```typescript
quotationItemId: string  // 어떤 항목을 오버라이드할지
quantity?: number
unitPrice?: number
vatType?: VatType
monthlyRentalPrice?: number
contractMonths?: number
depositAmount?: number
memo?: string
```

### CreateOrderDto
```typescript
type: OrderType                    // 필수 (SALE | RENTAL)
customerId: string                 // 필수
managerId?: string
orderDate?: string                 // ISO 날짜, 기본값: 오늘
memo?: string
// type === SALE
saleOrder?: CreateSaleOrderDto
// type === RENTAL
rentalOrder?: CreateRentalOrderDto
```

### CreateSaleOrderDto
```typescript
deliveryStaffId?: string
saleDate?: string        // ISO 날짜, 기본값: 오늘
items: CreateSaleOrderItemDto[]  // 최소 1개
```

### CreateSaleOrderItemDto
```typescript
productId: string    // 필수
assetId?: string     // 선택 (나중에 배정 가능)
serialNumber?: string
quantity: number     // 필수, 최소 1
unitPrice: number    // 필수, 최소 0
vatType: VatType     // 필수
isUsedAssetShipment?: boolean
warrantyStartDate?: string
warrantyEndDate?: string
marginAmount?: number
memo?: string
```

### CreateRentalOrderDto
```typescript
managementNo?: string
isRenewal?: boolean
contractDate?: string   // ISO 날짜, 기본값: 오늘
items: CreateRentalOrderItemDto[]  // 최소 1개
```

### CreateRentalOrderItemDto
```typescript
productId: string           // 필수
assetId?: string            // 선택 (나중에 배정 가능)
serialNumber?: string
monthlyRentalPrice: number  // 필수, 최소 0
depositAmount?: number
installationLocation?: string
specialTerms?: string
isUsedAssetShipment?: boolean
purchaseAmount?: number
warrantyExpiresAt?: string
memo?: string
```

### UpdateSaleOrderItemDto / UpdateRentalOrderItemDto
위 Create DTO의 모든 필드를 optional로 (PartialType 패턴).

---

## 비즈니스 로직

### 번호 자동 생성 (DocumentSequenceService)

```typescript
// YYYYMMDD-XXXX 포맷 생성
async generateNo(organizationId: string, type: DocumentSequenceType, tx: PrismaTransaction): Promise<string>
```

- `dateKey`: 오늘 날짜 `YYYYMMDD` (KST 기준)
- `$transaction` 안에서 호출 — 번호 채번과 문서 생성이 원자적으로 처리
- `upsert({ where: { organizationId_type_dateKey }, update: { nextValue: { increment: 1 } }, create: { nextValue: 1 } })`
- 읽은 `nextValue`를 4자리 zero-pad: `20260623-0001`

### Quotation 상태 전환 규칙

| 현재 상태 | 허용 전환 |
|---------|---------|
| `DRAFT` | `SENT`, `ACCEPTED`, `REJECTED`, `EXPIRED` |
| `SENT` | `ACCEPTED`, `REJECTED`, `EXPIRED` |
| `ACCEPTED` | — (불가) |
| `REJECTED` | — (불가) |
| `EXPIRED` | — (불가) |

- `SENT` 전환 시: `sentAt: new Date()` 설정
- 허용되지 않는 전환: `BadRequestException`

### Quotation 수정/항목 관리 제약
- `ACCEPTED`, `REJECTED`, `EXPIRED` 상태에서 수정/항목 추가·삭제 불가 → `BadRequestException`
- `DRAFT`만 삭제 가능 → 소프트 딜리트 없이 **하드 딜리트** (견적은 삭제되면 완전히 제거)

### Quotation → Order 변환 (`POST /quotations/:id/convert`)

1. 견적 조회 — `DRAFT`, `REJECTED`, `EXPIRED` 상태면 `BadRequestException('수락 가능한 상태의 견적만 변환할 수 있습니다.')`
2. `convertedOrderId` 존재 시 `ConflictException('이미 주문으로 변환된 견적입니다.')`
3. `$transaction`:
   - `orderNo` 채번 (DocumentSequenceService)
   - Order 생성 (type = quotation.type)
   - 타입에 따라 SaleOrder 또는 RentalOrder 생성
   - QuotationItem → SaleOrderItem/RentalOrderItem 복사 (금액 재계산, 오버라이드 적용)
   - Quotation: `status: ACCEPTED`, `convertedOrderId`, `convertedAt: new Date()` 업데이트
4. 반환: `{ orderId: string }`

### 금액 계산 (서버)

```typescript
function calculateAmounts(quantity: number, unitPrice: number, vatType: VatType) {
  if (vatType === 'NONE') {
    const supplyAmount = quantity * unitPrice;
    return { supplyAmount, vatAmount: 0, totalAmount: supplyAmount };
  }
  // INCLUDED: unitPrice가 VAT 포함 가격
  const totalAmount = quantity * unitPrice;
  const supplyAmount = Math.round(totalAmount / 1.1);
  const vatAmount = totalAmount - supplyAmount;
  return { supplyAmount, vatAmount, totalAmount };
}
```

QuotationItem, SaleOrderItem 생성/수정 시 항상 서버에서 재계산. RentalOrderItem은 `monthlyRentalPrice`만 저장 (VAT 계산 없음 — 렌탈료는 계약서 기준).

### Order 직접 생성

1. Customer 존재 확인
2. `$transaction`:
   - `orderNo` 채번
   - Order 생성
   - type === SALE: SaleOrder + SaleOrderItem 일괄 생성
   - type === RENTAL: RentalOrder + RentalOrderItem 일괄 생성
3. 반환: `{ orderId: string }`

### Order 항목 관리 제약
- Order `status === DELIVERED` 또는 `CANCELED`이면 항목 추가/삭제 `BadRequestException`
- `assetId` 배정 시: Asset이 같은 `organizationId` 소속인지 확인, 없으면 `NotFoundException`
- 판매 항목 추가/삭제는 SALE 타입 주문에서만, 렌탈 항목은 RENTAL 타입에서만

### Order 상태 전환

| 현재 상태 | 허용 전환 |
|---------|---------|
| `REGISTERED` | `CONFIRMED`, `CANCELED` |
| `CONFIRMED` | `IN_DELIVERY`, `CANCELED` |
| `IN_DELIVERY` | `DELIVERED`, `CANCELED` |
| `DELIVERED` | — (불가) |
| `CANCELED` | — (불가) |

### Order 삭제
- `REGISTERED` 상태만 삭제 가능 → `$transaction`으로 Order + SaleOrder/RentalOrder + 항목 모두 하드 딜리트
- 다른 상태: `BadRequestException('등록 상태의 주문만 삭제할 수 있습니다.')`

---

## 범위 밖

- RentalContract 생성/관리 — 영역 2에서 구현
- 청구서(Invoice) 연동
- 주문 상태 자동 전환 (예: 납품 완료 자동 감지)
- MeterReading 연동
- 주문 PDF 출력 / 견적서 발송 메일

---

## 테스트 전략

단위 테스트 (`*.service.spec.ts`):

- `DocumentSequenceService`: 동일 날짜 순차 채번, 다음 날 1부터 재시작
- `QuotationService`: 생성+번호채번, 상태 전환 허용/차단, 수정 제약(확정 상태), 변환(정상/재변환 차단/상태 차단), 항목 추가/삭제 제약
- `OrderService`: 직접 생성(SALE/RENTAL), 상태 전환 허용/차단, 삭제 제약
- `SaleOrderService`: 항목 추가/수정/삭제, 금액 계산 검증, assetId 배정, DELIVERED 상태 차단
- `RentalOrderService`: 항목 추가/수정/삭제, assetId 배정, CANCELED 상태 차단

모든 서비스는 Prisma mock 기반 단위 테스트. `$transaction`은 `fn(prisma)` 패턴으로 mock.
