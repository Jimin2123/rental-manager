# Model Data Workflows V2

이 문서는 현재 `apps/api/prisma/models`에 존재하는 Prisma model 기준으로, 서비스의 데이터 저장 흐름을 workflow별로 정리한다.

V1 문서는 일부 모델이 완성되기 전에 작성되었기 때문에, V2에서는 현재 모델에 맞춰 `Quotation`, `Invoice`, `TaxInvoice`, `Payment`, `Refund`, `ServiceRequest`, `AssetEvent`, `MeterReading`, `Attachment`, `AuditLog`까지 포함한다.

## 0. 문서 기준

이 문서는 ERD 전체 설명이 아니라 “업무가 진행될 때 어떤 테이블에 어떤 순서로 데이터가 저장되는가”를 설명한다.

현재 모델의 큰 축은 다음과 같다.

| 축 | 핵심 모델 | 역할 |
| --- | --- | --- |
| 사업장 기준 | `Organization`, `BusinessProfile`, `OrganizationMember` | 내 사업장과 내부 담당자 |
| 거래 대상 | `BusinessPartner`, `BusinessPartnerRole`, `BusinessPartnerContact`, `Customer`, `CustomerAssignment` | 거래처, 고객, 담당 관계 |
| 제품/장비 | `Product`, `Asset`, `AssetEvent`, `MeterReading` | 제품 카탈로그, 실제 장비, 장비 상태/검침 이력 |
| 영업 문서 | `Quotation`, `QuotationItem`, `Order`, `SaleOrder`, `SaleOrderItem`, `RentalOrder`, `RentalOrderItem` | 견적, 판매/렌탈 등록 문서 |
| 렌탈 계약 | `RentalContract`, `RentalContractItem` | 계약 원장, 실제 렌탈 중인 장비 단위 |
| 재무 | `Invoice`, `InvoiceItem`, `InvoiceAdjustment`, `TaxInvoice`, `Payment`, `PaymentAllocation`, `Refund` | 청구, 세금계산서, 입금, 배분, 환불 |
| AS | `ServiceRequest`, `ServiceVisit` | AS 접수와 방문 처리 |
| 공통 이력 | `Attachment`, `AuditLog`, `DocumentSequence` | 첨부파일, 변경 이력, 문서번호 채번 |

현재 구조에서 과거의 `RentalBilling` 역할은 `Invoice(type = RENTAL_MONTHLY)`가 담당한다.

## 1. 전체 데이터 흐름

서비스 전체 흐름을 한 줄로 보면 다음과 같다.

```txt
기준 정보
  -> 고객/제품/장비 등록
  -> 견적
  -> 판매 주문 또는 렌탈 주문
  -> 판매 출고 또는 렌탈 계약 활성화
  -> 청구서 발행
  -> 세금계산서 발행
  -> 입금 등록과 청구서 배분
  -> 환불/취소/이력 관리
```

모델 기준 전체 구조는 다음과 같다.

```txt
Organization
 ├─ BusinessProfile
 ├─ OrganizationMember
 ├─ BusinessPartner
 │   ├─ BusinessProfile
 │   ├─ BusinessPartnerRole
 │   └─ BusinessPartnerContact
 ├─ Customer
 │   ├─ IndividualProfile
 │   └─ BusinessPartner
 ├─ CustomerAssignment
 ├─ Product
 │   └─ Asset
 │       ├─ AssetEvent
 │       ├─ MeterReading
 │       └─ ServiceRequest
 ├─ Quotation
 │   └─ QuotationItem
 ├─ Order
 │   ├─ SaleOrder
 │   │   └─ SaleOrderItem
 │   └─ RentalOrder
 │       ├─ RentalOrderItem
 │       └─ RentalContract
 │           └─ RentalContractItem
 ├─ Invoice
 │   ├─ InvoiceItem
 │   ├─ InvoiceAdjustment
 │   ├─ TaxInvoice
 │   ├─ PaymentAllocation
 │   └─ Refund
 ├─ Payment
 ├─ Attachment
 ├─ DocumentSequence
 └─ AuditLog
```

## 2. 내 사업장 등록 workflow

내 사업장은 `Address`, `BusinessProfile`, `Organization` 순서로 저장한다.

```txt
Address
  -> BusinessProfile
      -> Organization
```

| 저장 대상 | 저장 데이터 | 비고 |
| --- | --- | --- |
| `Address` | 우편번호, 기본 주소, 상세 주소, 도로명/지번 주소, 건물명 | 주소 원본 |
| `BusinessProfile` | 상호, 사업자등록번호, 대표자명, 업태, 종목, 대표 이메일/전화 | 사업자 정보 |
| `Organization` | 내 사업장 기준 row, 메모 | 모든 업무 데이터의 기준 |

`BusinessProfile`은 내 사업장과 거래처가 같이 사용하는 구조다. 단, 하나의 `BusinessProfile`은 `Organization` 또는 `BusinessPartner` 중 하나에만 연결되어야 한다.

## 2.1 문서번호 채번 workflow

문서번호는 service transaction 안에서 `DocumentSequence`를 이용해 사업장, 문서 타입, 날짜별로 증가시킨다.

```txt
Organization
  -> DocumentSequence(type, dateKey, nextValue)
      -> 문서번호: PREFIX-YYYYMMDD-0001
```

| 저장 대상 | 저장 데이터 | 비고 |
| --- | --- | --- |
| `DocumentSequence` | 문서 타입, 날짜 키, 다음 번호 | `organizationId + type + dateKey` 기준 1행 |

`DocumentNumberService`는 같은 transaction client에서 `DocumentSequence.nextValue`를 원자적으로 증가시키고 `ORD-20260616-0001` 같은 번호를 반환한다.

## 3. 내 사업장 직원 workflow

직원은 로그인 사용자가 아니라 업무 담당자 명부다.

```txt
Organization
  -> OrganizationMember
```

| 저장 대상 | 저장 데이터 | 연결 위치 |
| --- | --- | --- |
| `OrganizationMember` | 이름, 부서, 직급, 전화, 이메일, 활성 상태, 메모 | 고객 담당, 주문 담당, 작성자, 납품자, AS 방문자, 첨부 업로드자, 감사 로그 행위자 |

현재 `createdById`가 있는 주요 모델은 `Order`, `RentalContract`, `Invoice`, `Payment`다.

## 4. 거래처 등록 workflow

거래처는 내 사업장이 관리하는 외부 사업자다.

```txt
Address
  -> BusinessProfile
      -> BusinessPartner
          -> BusinessPartnerRole
          -> BusinessPartnerContact
```

| 저장 대상 | 저장 데이터 | 의미 |
| --- | --- | --- |
| `Address` | 거래처 주소 | 사업자 주소 |
| `BusinessProfile` | 거래처 상호, 사업자등록번호, 대표자, 연락처 | 거래처 사업자 정보 |
| `BusinessPartner` | 내 사업장에서 관리하는 거래처 row, 활성 상태, 메모, 삭제 시점 | 거래처 관리 원장 |
| `BusinessPartnerRole` | `SALES`, `PURCHASE` | 매출/매입 거래처 구분 |
| `BusinessPartnerContact` | 담당자명, 부서, 직급, 역할, 연락처, 대표 여부 | 거래처 담당자 |

거래처 구분은 `BusinessPartnerRole`을 여러 개 저장해서 표현한다.

| 업무 구분 | 저장 방식 |
| --- | --- |
| 매출 거래처 | `BusinessPartnerRole(type = SALES)` |
| 매입 거래처 | `BusinessPartnerRole(type = PURCHASE)` |
| 매출/매입 모두 | 같은 `BusinessPartner`에 `SALES`, `PURCHASE`를 각각 저장 |

판매/렌탈 주문의 고객으로 쓰일 사업자 고객은 `SALES` role이 필요하다.

## 5. 고객 등록 workflow

`Customer`는 견적, 주문, 청구, 세금계산서, 입금, 환불, AS의 공통 기준점이다.

### 5.1 개인 고객

```txt
Address?
  -> IndividualProfile
      -> Customer(type = INDIVIDUAL)
```

| 저장 대상 | 저장 데이터 | 비고 |
| --- | --- | --- |
| `Address` | 개인 고객 주소 | 선택 |
| `IndividualProfile` | 고객명, 전화, 이메일, 주소 | 개인 상세 정보 |
| `Customer` | `organizationId`, `type = INDIVIDUAL`, `individualProfileId`, 활성 상태, 메모 | 업무 문서에서 선택하는 고객 |

### 5.2 사업자 고객

```txt
BusinessPartner(SALES role)
  -> Customer(type = BUSINESS)
```

| 저장 대상 | 저장 데이터 | 비고 |
| --- | --- | --- |
| `BusinessPartner` | 거래처 사업자 정보와 내부 관리 상태 | `SALES` role 필요 |
| `Customer` | `organizationId`, `type = BUSINESS`, `businessPartnerId`, 활성 상태, 메모 | 업무 문서에서 선택하는 고객 |

`Customer.isActive = false`는 거래 정지 상태다. 삭제가 아니라 신규 판매/계약을 막기 위한 업무 상태로 사용한다.

## 6. 고객 담당자 배정 workflow

내 사업장 담당자와 고객 측 담당자를 연결한다.

```txt
OrganizationMember
  -> CustomerAssignment
      -> Customer
      -> BusinessPartnerContact | IndividualProfile
```

| 저장 대상 | 저장 데이터 | 의미 |
| --- | --- | --- |
| `OrganizationMember` | 내 사업장 담당 직원 | 우리 회사 담당자 |
| `BusinessPartnerContact` | 거래처 담당자 | 사업자 고객의 상대 담당자 |
| `IndividualProfile` | 개인 고객 본인 | 개인 고객 연락 대상 |
| `CustomerAssignment` | 담당 직원, 고객, 고객 측 연락 대상, 역할, 대표 여부, 시작/종료일 | 담당 관계 |

고객 타입별 연결 규칙은 다음과 같다.

| 고객 타입 | 연결 대상 |
| --- | --- |
| 개인 고객 | `individualProfileId`가 해당 고객의 `IndividualProfile`이어야 한다. |
| 사업자 고객 | `customerContactId`가 해당 고객의 `BusinessPartnerContact`여야 한다. |

## 7. 제품/장비 workflow

제품과 실제 장비는 분리한다.

```txt
Product
  -> Asset
      -> AssetEvent
      -> MeterReading
      -> ServiceRequest
```

| 저장 대상 | 저장 데이터 | 의미 |
| --- | --- | --- |
| `Product` | 제품명, 제조사, 모델명, 카테고리, 메모, 활성 상태 | 제품 종류 또는 카탈로그 |
| `Asset` | 제품, 시리얼 번호, 상태, 매입일, 매입가, 폐기/분실 사유, 메모 | 실제 장비 1대 |
| `AssetEvent` | 이전 상태, 변경 상태, 발생 출처, 메모 | 장비 상태 변경 이력 |
| `MeterReading` | 검침일, 흑백/컬러 누적 카운터, 사용량, 검침 방식, 청구 항목 연결 | 카운터 과금 근거 |

예시는 다음과 같다.

```txt
Product: 삼성 복합기 SL-X3220
Asset:   SL-X3220 / serialNumber A001
Asset:   SL-X3220 / serialNumber A002
```

`Asset`은 견적, 판매 품목, 렌탈 등록 품목에서는 선택이다. 하지만 실제 렌탈 계약에서 점유 중인 장비를 표현하는 `RentalContractItem`은 `assetId`가 필수다.

장비 상태는 다음 enum으로 관리한다.

| 상태 | 의미 |
| --- | --- |
| `INCOMING` | 입고 예정 |
| `AVAILABLE` | 판매/렌탈 가능 |
| `RENTED` | 렌탈 중 |
| `SOLD` | 판매 완료 |
| `REPAIR` | 수리 중 |
| `DISPOSED` | 폐기 |
| `LOST` | 분실 |
| `UNAVAILABLE` | 사용 불가 |

상태 변경은 `Asset.status`를 바꾸고, 그 근거를 `AssetEvent`에 남기는 흐름이 맞다.

## 8. 견적 workflow

견적은 판매 견적과 렌탈 견적을 모두 표현한다.

```txt
Customer
  -> Quotation(type = SALE | RENTAL)
      -> QuotationItem[]
          -> Product
          -> Asset?
```

| 저장 대상 | 저장 데이터 | 비고 |
| --- | --- | --- |
| `Quotation` | 견적번호, 상태, 타입, 고객, 유효기간, 발송일, 메모 | 견적 헤더 |
| `QuotationItem` | 제품, 장비, 설명, 수량, 단가, 공급가액, 부가세, 합계, 메모 | 견적 품목 |
| `QuotationItem` 렌탈 필드 | 월 렌탈료, 계약 개월 수, 보증금 | 렌탈 견적일 때 사용 |

상태는 다음 흐름으로 사용한다.

```txt
DRAFT -> SENT -> ACCEPTED
              -> REJECTED
              -> EXPIRED
```

견적이 수락되면 `Order`로 전환한다.

```txt
Quotation(status = ACCEPTED)
  -> Order
      <- Quotation.convertedOrderId
```

전환 시점에는 service에서 견적 품목을 판매 또는 렌탈 주문 품목으로 복사해야 한다. DB는 `convertedOrderId`로 전환된 주문과 견적의 1:1 연결만 보장한다.

## 9. 공통 주문 workflow

판매와 렌탈은 모두 `Order`를 공통 헤더로 사용한다.

```txt
Customer
  -> Order(type = SALE | RENTAL)
      -> SaleOrder | RentalOrder
```

| 저장 대상 | 저장 데이터 | 의미 |
| --- | --- | --- |
| `Order` | 주문번호, 타입, 상태, 고객, 내 담당 직원, 주문일, 작성자, 메모 | 판매/렌탈 공통 문서 헤더 |
| `SaleOrder` | 판매 전용 상세 | `Order.type = SALE`일 때 |
| `RentalOrder` | 렌탈 등록 전용 상세 | `Order.type = RENTAL`일 때 |

`Order.status`는 다음 흐름으로 사용한다.

```txt
REGISTERED -> CONFIRMED -> IN_DELIVERY -> DELIVERED
          \-> CANCELED
CONFIRMED \-> CANCELED
IN_DELIVERY \-> CANCELED
```

`orderNo`는 `organizationId + orderNo` 유니크만 DB가 보장한다. `2026-06-16 + Auto Increment` 같은 채번 규칙은 service에서 처리해야 한다.

## 10. 판매 workflow

판매는 주문 등록, 출고, 청구, 입금으로 이어진다.

```txt
Order(type = SALE)
  -> SaleOrder
      -> SaleOrderItem[]
          -> Product
          -> Asset?
  -> Invoice(type = SALE)
      -> InvoiceItem(type = SALE_PRICE)
  -> TaxInvoice?
  -> Payment
      -> PaymentAllocation
```

### 10.1 판매 등록

| 저장 대상 | 저장 데이터 | 비고 |
| --- | --- | --- |
| `Order` | 주문번호, 고객, 담당 직원, 주문일, 작성자, 상태 | 공통 헤더 |
| `SaleOrder` | 판매일, 납품 직원 | 판매 헤더 |
| `SaleOrderItem` | 제품, 장비, 직접 입력 시리얼, 중고장비 여부, 수량, 단가, 공급가액, 부가세, 합계, 마진, 보증기간, 메모 | 판매 품목 |

금액 계산식은 다음과 같다.

```txt
quantity * unitPrice = supplyAmount
supplyAmount + vatAmount = totalAmount
```

`SaleOrderItem.assetId`가 있으면 같은 `organizationId`, 같은 `productId`에 속한 `Asset`이어야 한다.

### 10.2 판매 출고와 장비 상태

판매 품목에 실제 장비가 연결되어 있으면, 출고 확정 시 service에서 다음 처리를 같이 수행해야 한다.

```txt
Asset.status = SOLD
AssetEvent(sourceType = SALE_ORDER, sourceId = SaleOrder.id, toStatus = SOLD)
```

DB는 주문 품목과 장비의 조직/제품 일치까지 보장하지만, `Asset.status` 변경과 `AssetEvent` 생성은 service transaction에서 처리해야 한다.

### 10.3 판매 청구

판매 청구는 `Invoice(type = SALE)`로 만든다.

```txt
SaleOrder
  -> Invoice(type = SALE)
      -> InvoiceItem(type = SALE_PRICE, saleOrderItemId)
```

판매 청구 규칙은 다음과 같다.

| 규칙 | 설명 |
| --- | --- |
| `Invoice.type = SALE` | `saleOrderId`가 필요하다. |
| `InvoiceItem.type = SALE_PRICE` | `saleOrderItemId`가 필요하다. |
| 판매 청구 1:1 | 같은 `organizationId`에서 하나의 `SaleOrder`는 하나의 `Invoice`만 가질 수 있다. |
| 최종 청구 금액 | `InvoiceItem` 합계와 `InvoiceAdjustment` 합계로 `Invoice.finalAmount`가 재계산된다. |

## 11. 렌탈 workflow

렌탈은 등록 문서, 계약, 실제 장비 점유, 월 청구가 분리된다.

```txt
Order(type = RENTAL)
  -> RentalOrder
      -> RentalOrderItem[]
      -> RentalContract
          -> RentalContractItem[]
              -> Asset
              -> MeterReading?
  -> Invoice(type = RENTAL_MONTHLY)
      -> InvoiceItem[]
```

### 11.1 렌탈 등록

`RentalOrder`는 렌탈 접수/등록 문서다.

| 저장 대상 | 저장 데이터 | 비고 |
| --- | --- | --- |
| `Order` | 주문번호, 고객, 담당 직원, 주문일, 작성자, 상태 | 공통 헤더 |
| `RentalOrder` | 렌탈 관리번호, 재계약 여부, 계약일 | 렌탈 등록 헤더 |
| `RentalOrderItem` | 제품, 장비, 직접 입력 시리얼, 중고장비 여부, 매입금액, 보증만료일, 월 렌탈료, 보증금, 설치 위치, 특약, 메모 | 렌탈 등록 품목 |

`RentalOrderItem.assetId`는 선택이다. 등록 시점에는 제품과 렌탈 조건만 먼저 저장하고, 실제 계약 활성화 시 `RentalContractItem.assetId`로 장비를 확정할 수 있다.

### 11.2 렌탈 계약 생성

계약이 확정되면 `RentalContract`를 만든다.

```txt
RentalOrder
  -> RentalContract(status = DRAFT)
      -> RentalContractItem(status = PENDING)
```

| 저장 대상 | 저장 데이터 | 비고 |
| --- | --- | --- |
| `RentalContract` | 계약번호, 상태, 재계약 여부, 시작일, 종료일, 계약 개월 수, 청구일, 납부 기한일, 선불/후불, 작성자 | 계약 원장 |
| `RentalContractItem` | 계약, 원 렌탈 등록 품목, 실제 장비, 월 렌탈료, 상태, 시작/종료/회수일, 과금 타입, 설치 주소, 교체 관계 | 실제 계약 장비 단위 |

`RentalContract.status` 흐름은 다음과 같다.

```txt
DRAFT -> ACTIVE -> ENDED
      \-> CANCELED
ACTIVE \-> CANCELED
```

`RentalContractItem.status` 흐름은 다음과 같다.

```txt
PENDING -> ACTIVE -> RETURNED
        \-> CANCELED
ACTIVE  -> REPLACED
ACTIVE  -> CANCELED
```

`RentalContractItem`은 실제 렌탈 중인 장비 단위다. 같은 장비는 동시에 하나의 active 계약 품목만 가질 수 있도록 partial unique index가 migration에 정의되어 있다.

### 11.3 계약 활성화와 장비 상태

계약을 활성화할 때는 service에서 다음 처리를 같은 transaction으로 묶는 것이 맞다.

```txt
RentalContract.status = ACTIVE
RentalContractItem.status = ACTIVE
Asset.status = RENTED
AssetEvent(sourceType = RENTAL_CONTRACT_ITEM, sourceId = RentalContractItem.id, toStatus = RENTED)
```

계약 종료, 회수, 교체 시에도 `RentalContractItem.status`, `Asset.status`, `AssetEvent`를 같이 처리해야 한다.

### 11.4 렌탈 청구

현재 모델에는 `RentalBilling`이 없다. 렌탈 청구는 `Invoice(type = RENTAL_MONTHLY)`로 저장한다.

```txt
RentalContract
  -> Invoice(type = RENTAL_MONTHLY, billingMonth, periodStart, periodEnd)
      -> InvoiceItem(type = RENTAL_FEE, rentalOrderItemId)
      -> InvoiceItem(type = DEPOSIT)?
      -> InvoiceItem(type = INSTALLATION_FEE)?
      -> InvoiceAdjustment[]?
```

렌탈 청구 규칙은 다음과 같다.

| 규칙 | 설명 |
| --- | --- |
| `Invoice.type = RENTAL_MONTHLY` | `rentalContractId`, `billingMonth`, `periodStart`, `periodEnd`가 필요하다. |
| 월별 중복 방지 | 같은 `organizationId + rentalContractId + billingMonth + type`은 1건만 허용된다. |
| `InvoiceItem.type = RENTAL_FEE` | `rentalOrderItemId`가 필요하다. |
| 보증금/설치비 | `InvoiceItem.type = DEPOSIT`, `INSTALLATION_FEE`로 같은 invoice에 같이 담을 수 있다. |
| 할인/조정 | `InvoiceAdjustment`에 음수 또는 양수 금액으로 저장한다. |

초기 청구 예시는 다음과 같다.

```txt
Invoice(type = RENTAL_MONTHLY, billingMonth = "2026-06")
  ├─ InvoiceItem(type = DEPOSIT)
  ├─ InvoiceItem(type = INSTALLATION_FEE)
  └─ InvoiceItem(type = RENTAL_FEE)
```

이후 월 반복 청구는 보통 `RENTAL_FEE` 중심으로 새 `Invoice`를 생성한다.

### 11.5 고정 렌탈료와 카운터 과금

`RentalContractItem.billingType`으로 과금 방식을 구분한다.

| 과금 방식 | 저장 방식 |
| --- | --- |
| `FIXED` | `RentalContractItem.monthlyRentalPrice`를 기준으로 월 렌탈료 `InvoiceItem` 생성 |
| `METER` | `MeterReading`으로 기간 사용량을 저장하고, 계산된 초과 사용료를 `InvoiceItem(type = METER_USAGE)`에 저장 |

카운터 검침 흐름은 다음과 같다.

```txt
RentalContractItem(billingType = METER)
  -> MeterReading(assetId, readingDate, blackUsage, colorUsage)
      -> InvoiceItem(type = METER_USAGE, rentalContractItemId)
```

`MeterReading`은 같은 장비의 같은 검침일 중복을 막고, 이전/다음 검침 대비 누적 카운터가 역행하지 않도록 migration trigger가 검증한다.
청구 항목에 연결할 때는 `InvoiceItem.type = METER_USAGE`이고 같은 `rentalContractItemId`를 바라봐야 한다.

## 12. AS workflow

AS는 접수, 방문 처리, 청구로 이어진다.

```txt
Customer
  -> Asset
      -> ServiceRequest
          -> ServiceVisit[]
          -> Invoice(type = SERVICE_FEE)?
```

| 저장 대상 | 저장 데이터 | 비고 |
| --- | --- | --- |
| `ServiceRequest` | 접수번호, 상태, 유형, 고객, 장비, 보증 여부, 증상, 희망 방문일, 완료일, 방문 위치, 메모 | AS 접수 |
| `ServiceVisit` | 방문 담당자, 상태, 예약/방문일, 작업 내용, 결과, 공임/부품/출장비, 재방문 여부, 메모 | AS 방문 이력 |
| `Invoice(type = SERVICE_FEE)` | AS 유상 청구 | `serviceRequestId` 필요 |

`ServiceRequest.status` 흐름은 다음과 같다.

```txt
RECEIVED -> SCHEDULED -> IN_PROGRESS -> COMPLETED
        \-> IN_PROGRESS
        \-> CANCELED
SCHEDULED -> WAITING_FOR_PARTS
IN_PROGRESS -> WAITING_FOR_PARTS
WAITING_FOR_PARTS -> SCHEDULED | IN_PROGRESS | CANCELED
```

`ServiceVisit.status` 흐름은 다음과 같다.

```txt
SCHEDULED -> IN_PROGRESS -> COMPLETED
          \-> COMPLETED
          \-> CANCELED
IN_PROGRESS -> CANCELED
```

AS 접수나 방문 처리로 장비 상태가 바뀌면 다음 이력을 남긴다.

```txt
Asset.status = REPAIR | AVAILABLE | UNAVAILABLE
AssetEvent(sourceType = SERVICE_REQUEST | SERVICE_VISIT, sourceId = ..., toStatus = ...)
```

## 13. 통합 청구 workflow

`Invoice`는 판매, 렌탈, AS, 수동 청구를 통합한다.

```txt
Invoice
  ├─ InvoiceItem[]
  ├─ InvoiceAdjustment[]
  ├─ TaxInvoice?
  ├─ PaymentAllocation[]
  └─ Refund[]
```

`Invoice.type`별 source 규칙은 다음과 같다.

| `Invoice.type` | 필요한 source | 기간 필드 |
| --- | --- | --- |
| `SALE` | `saleOrderId` | 없음 |
| `RENTAL_MONTHLY` | `rentalContractId` | `billingMonth`, `periodStart`, `periodEnd` 필요 |
| `SERVICE_FEE` | `serviceRequestId` | 없음 |
| `MANUAL` | source 없음 | 업무 정책에 따라 사용 |

`Invoice.status` 흐름은 다음과 같다.

```txt
DRAFT -> ISSUED -> CANCELED
      \-> CANCELED
```

`Invoice.finalAmount`는 청구서 조회와 미수금 쿼리 성능을 위해 저장하는 역정규화 값이다. migration trigger가 `InvoiceItem`과 `InvoiceAdjustment` 변경 시 자동 재계산한다.

```txt
Invoice.finalAmount
  = SUM(InvoiceItem.totalAmount)
  + SUM(InvoiceAdjustment.amount)
```

`InvoiceAdjustment.amount`는 할인/차감이면 음수, 추가 청구면 양수로 저장한다.

## 14. 세금계산서 workflow

세금계산서는 `Invoice` 단위로 1:1 발행한다. 별도 `TaxInvoiceItem`이나 `InvoiceItem.taxInvoiceId`는 두지 않는다.
세금계산서에 포함되는 항목은 `TaxInvoice.invoiceId -> Invoice.items`로 조회한다.
부분 발행이 필요한 업무는 현재 MVP 범위가 아니며, 이 경우에는 별도 `TaxInvoiceLine` 모델을 추가하는 별도 설계가 필요하다.

```txt
Invoice
  -> TaxInvoice(type = TAX_INVOICE)
      -> Invoice.items
```

| 저장 대상 | 저장 데이터 | 비고 |
| --- | --- | --- |
| `TaxInvoice` | 세금계산서번호, 타입, 상태, 원본 세금계산서, 연결 청구서, 고객, 공급받는자 스냅샷, 금액, 발행일, 국세청 승인번호, 외부 참조 | 세금계산서 헤더 |
| `Invoice.items` | 세금계산서에 포함되는 청구 항목 조회 경로 | `TaxInvoice.invoiceId`로 연결된 청구서의 항목을 조회 |

수정세금계산서는 `TaxInvoice(type = CREDIT_NOTE)`로 만들고 `originalTaxInvoiceId`를 원본 세금계산서에 연결한다.

```txt
TaxInvoice(type = TAX_INVOICE)
  -> TaxInvoice(type = CREDIT_NOTE, originalTaxInvoiceId)
```

주요 규칙은 다음과 같다.

| 규칙 | 설명 |
| --- | --- |
| 일반 세금계산서 | `originalTaxInvoiceId`가 없어야 한다. |
| 수정세금계산서 | `originalTaxInvoiceId`가 필요하고 원본은 `TAX_INVOICE`여야 한다. |
| 고객 일치 | 세금계산서 고객은 연결 청구서 또는 원본 세금계산서 고객과 같아야 한다. |
| 국세청 승인 | `status = NTS_CONFIRMED`이면 `ntsConfirmNum`이 필요하다. |
| 항목 연결 | 세금계산서는 청구서 전체 단위로 발행하므로 항목별 세금계산서 연결은 저장하지 않는다. |

## 15. 입금과 수납 배분 workflow

입금은 고객 기준으로 먼저 등록하고, 청구서에 배분한다.

```txt
Customer
  -> Payment
      -> PaymentAllocation[]
          -> Invoice
```

| 저장 대상 | 저장 데이터 | 비고 |
| --- | --- | --- |
| `Payment` | 입금번호, 고객, 상태, 결제수단, provider, 입금액, 입금일, 작성자, 외부 참조, 메모 | 입금 원장 |
| `PaymentAllocation` | 입금, 청구서, 배분 금액, 메모 | 청구서별 수납 배분 |

`Payment.status` 흐름은 다음과 같다.

```txt
PENDING -> COMPLETED
        -> FAILED -> PENDING
        -> CANCELED
COMPLETED -> CANCELED
```

배분 규칙은 다음과 같다.

| 규칙 | 설명 |
| --- | --- |
| 고객 일치 | `Payment.customerId`와 `Invoice.customerId`가 같아야 한다. |
| 초과 배분 금지 | 한 입금의 `PaymentAllocation.amount` 합계는 `Payment.amount`를 초과할 수 없다. |
| 금액 양수 | `Payment.amount`, `PaymentAllocation.amount`는 항상 양수다. |

## 16. 환불 workflow

환불은 청구서 기준으로 잡고, 필요하면 원 입금도 연결한다.

```txt
Invoice
  -> Refund
      -> Payment?
```

| 저장 대상 | 저장 데이터 | 비고 |
| --- | --- | --- |
| `Refund` | 환불번호, 고객, 청구서, 입금, 상태, 사유, 금액, 환불수단, 환불일, 메모 | 환불 이력 |

`Refund.status` 흐름은 다음과 같다.

```txt
PENDING -> COMPLETED
        -> FAILED -> PENDING
        -> CANCELED
```

환불 규칙은 다음과 같다.

| 규칙 | 설명 |
| --- | --- |
| 고객 일치 | 환불 고객은 청구서 고객과 같아야 한다. |
| 입금 연결 시 고객 일치 | `paymentId`가 있으면 입금 고객도 환불 고객과 같아야 한다. |
| 환불 한도 | 취소되지 않은 환불 합계는 완료된 입금 배분액을 초과할 수 없다. |
| 금액 양수 | `Refund.amount`는 항상 양수다. |

## 17. 첨부파일 workflow

첨부파일은 여러 업무 문서에 붙는 공통 모델이다.

```txt
Attachment(sourceType, sourceId)
  -> RentalContract | SaleOrder | ServiceRequest | ServiceVisit | Invoice | Customer | Quotation
```

| 저장 대상 | 저장 데이터 | 비고 |
| --- | --- | --- |
| `Attachment` | sourceType, sourceId, 파일 분류, 파일명, URL, MIME type, 파일 크기, 업로드 직원, 생성일 | 불변 첨부 기록 |

현재 지원 sourceType은 migration trigger 기준으로 `RentalContract`, `SaleOrder`, `ServiceRequest`, `ServiceVisit`, `Invoice`, `Customer`, `Quotation`이다.

파일 자체는 DB에 저장하지 않고 `fileUrl`로 참조한다.

## 18. 감사 로그 workflow

중요 변경은 `AuditLog`에 남긴다.

```txt
Actor(OrganizationMember?)
  -> AuditLog(targetType, targetId, action)
```

| 저장 대상 | 저장 데이터 | 비고 |
| --- | --- | --- |
| `AuditLog` | 행위자, action, targetType, targetId, 변경 전/후 Json, 사유, 생성일 | 불변 변경 이력 |

`AuditAction`은 다음 값을 가진다.

| action | 의미 |
| --- | --- |
| `CREATE` | 생성 |
| `UPDATE` | 수정 |
| `STATUS_CHANGE` | 상태 변경 |
| `CANCEL` | 취소/soft delete |

`AuditLog`는 자동 생성 모델이 아니라 service에서 명시적으로 작성해야 한다. DB trigger는 targetType/targetId가 실제 존재하는지만 검증한다.

## 19. 주요 무결성 규칙

현재 migration에서 DB 레벨로 보호하는 핵심 규칙이다.

| 영역 | 규칙 |
| --- | --- |
| 조직 경계 | 대부분의 주요 관계는 `id + organizationId` composite FK로 같은 사업장 안의 데이터만 연결된다. |
| 사업자 정보 | 하나의 `BusinessProfile`은 내 사업장 또는 거래처 중 하나에만 연결된다. |
| 주소 | 하나의 `Address`는 사업자 정보 또는 개인 프로필 중 하나에만 연결된다. |
| 거래처 사업자등록번호 | 같은 사업장 안에서 active 거래처의 사업자등록번호 중복을 막는다. |
| 고객 타입 | 개인 고객은 `individualProfileId`, 사업자 고객은 `businessPartnerId`만 가진다. |
| 고객 담당자 | 개인/사업자 고객 타입에 맞는 담당 대상만 연결할 수 있다. |
| 매출 거래처 | 사업자 고객과 주문 고객으로 쓰는 거래처는 `SALES` role이 필요하다. |
| 주문 타입 | `SaleOrder`는 `Order.type = SALE`, `RentalOrder`는 `Order.type = RENTAL`만 참조한다. |
| 제품/장비 | 주문/견적 품목의 `Asset`은 같은 `Product`와 같은 `Organization`에 속해야 한다. |
| 금액 계산 | `quantity * unitPrice = supplyAmount`, `supplyAmount + vatAmount = totalAmount`를 검사한다. |
| VAT 타입 | `VatType.NONE`이면 부가세 0, `VatType.INCLUDED`이면 부가세가 0보다 커야 한다. |
| 렌탈 계약 | 종료일은 시작일보다 빠를 수 없고, 계약 개월 수는 0보다 커야 한다. |
| 렌탈 장비 | 같은 장비는 동시에 active `RentalContractItem` 1개만 가능하다. |
| 청구 source | `Invoice.type`별로 필요한 source가 다르다. |
| 청구 금액 | `Invoice.finalAmount`는 item과 adjustment 합계로 자동 재계산된다. |
| 입금 배분 | 같은 고객의 청구서에만 배분할 수 있고, 입금액 초과 배분은 불가능하다. |
| 환불 한도 | 완료된 입금 배분액보다 많이 환불할 수 없다. |
| 세금계산서 | 청구서/고객/수정세금계산서 원본 관계를 검증한다. |
| 첨부/감사 로그 | polymorphic source/target이 실제 존재해야 한다. |
| 검침 | 같은 장비의 같은 검침일 중복을 막고, 누적 카운터 역행을 막는다. |

## 20. service 계층에서 처리해야 하는 부분

DB 모델과 trigger가 모든 업무 흐름을 자동으로 실행하지는 않는다. 아래는 service에서 처리해야 한다.

| 처리 | 이유 |
| --- | --- |
| 번호 채번 | `DocumentNumberService`가 `DocumentSequence`를 이용해 `orderNo`, `quotationNo`, `contractNo`, `invoiceNo`, `paymentNo`, `refundNo`, `taxInvoiceNo`, `requestNo`, `managementNo` 생성 |
| 견적 전환 | `QuotationItem`을 `SaleOrderItem` 또는 `RentalOrderItem`으로 복사 |
| 판매 출고 | `Asset.status = SOLD`, `AssetEvent` 생성 |
| 렌탈 활성화 | `OrderWorkflowService`가 `RentalContract.status`, `RentalContractItem.status`, `Asset.status = RENTED`, `AssetEvent`, `AuditLog`를 같은 transaction으로 처리 |
| 렌탈 종료/회수/교체 | 계약 품목 상태, 장비 상태, 교체 관계, 장비 이벤트 동기화 |
| 월 청구 생성 | 계약 기간, 청구일, 선불/후불, 품목 과금 방식에 따라 `Invoice`와 `InvoiceItem` 생성 |
| 카운터 과금 계산 | `MeterReading` 사용량과 무료 매수/초과 단가를 이용해 청구 금액 계산 |
| AS 상태와 장비 상태 동기화 | AS 접수/방문 결과에 따라 `Asset.status`와 `AssetEvent` 생성 |
| 세금계산서 발행 연동 | 외부 발행 서비스 호출, `externalRef`, `ntsConfirmNum`, `sentAt` 저장 |
| 입금 상태 갱신 | PG/은행 연동 결과에 따른 `Payment.status` 변경 |
| 감사 로그 생성 | 생성/수정/상태 변경/취소 시 `AuditLog` 작성 |
| 첨부 업로드 | 파일 저장소 업로드 후 `Attachment.fileUrl` 저장 |

## 21. 현재 모델상 정책 결정이 필요한 부분

아래는 모델은 존재하지만 service 정책을 정해야 안정적으로 구현할 수 있는 부분이다.

| 주제 | 결정 필요 사항 |
| --- | --- |
| 보증금 회계 처리 | `InvoiceItem(type = DEPOSIT)`로 청구되지만, 매출/보증금 부채 처리는 별도 회계 정책이 필요하다. |
| 매입 workflow | `BusinessPartnerRole(type = PURCHASE)`와 장비 매입가 필드는 있으나 매입 주문/매입 청구 모델은 없다. |
| 재고/입출고 이력 | `AssetEvent`는 상태 변경 이력이고, 별도 재고 수불장 모델은 없다. |
| 사용자/Auth | 현재 행위자는 `OrganizationMember`이고 로그인 사용자 모델은 없다. |
| 부분 세금계산서 | 현재 MVP 범위가 아니며, 필요해지면 `TaxInvoiceLine` 같은 별도 라인 모델로 다시 설계해야 한다. |
| 취소 문서 | 상태는 `CANCELED`로 관리하지만, 취소 사유/취소 이력은 `AuditLog`와 adjustment/refund로 남겨야 한다. |
