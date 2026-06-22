# Customer Module Design

## Overview

고객(Customer)과 거래처(BusinessPartner)를 관리하는 모듈. 개인/법인 고객 등록, 거래처 담당자 관리, 직원 배정(CustomerAssignment)을 포함한다.

---

## Domain Model

### Customer
고객 관계 레코드. 한 Organization 안에서 개인(`INDIVIDUAL`) 또는 법인(`BUSINESS`) 타입으로 존재한다.

- `type: CustomerType` — `INDIVIDUAL` | `BUSINESS`
- `individualProfileId?` — INDIVIDUAL 타입일 때 연결
- `businessPartnerId?` — BUSINESS 타입일 때 연결
- `isActive` — `false` 시 거래 정지 (신규 주문 불가), `deletedAt`과 별개
- `deletedAt` — 소프트 삭제 (목록에서 숨김)
- `memo` — 내부 메모

### IndividualProfile
개인 고객의 인적 사항. `organizationId` 없음 — 여러 조직에서 공유 가능한 구조이나 MVP에서는 Customer 생성 시 항상 새로 생성한다.

- `name`, `phone?`, `email?`, `addressId?`

### BusinessPartner
법인 거래처. `organizationId`로 tenant 격리.

- `businessProfileId @unique` → `BusinessProfile` (상호, 사업자등록번호, 대표자명 등)
- `isActive`, `memo`, `deletedAt`
- `roles BusinessPartnerRole[]` — `SALES` | `PURCHASE`
- `contacts BusinessPartnerContact[]` — 거래처 담당자

### BusinessPartnerContact
거래처 담당자. BusinessPartner 조회 시 항상 함께 반환.

- `name`, `department?`, `position?`, `role?`, `phone?`, `email?`, `isPrimary`

### CustomerAssignment
직원-고객 배정 레코드.

- `organizationMemberId` — 담당 직원
- `customerContactId?` — 법인 거래처의 담당 창구
- `individualProfileId?` — 개인 고객의 본인
- `role String?` — 자유 텍스트 (예: "영업담당", "AS전담")
- `isPrimary Boolean` — 주담당자 여부
- `startedAt`, `endedAt?` — 배정 기간

---

## API Endpoints

### Customer (`/customers`)

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/customers` | 목록 조회 | 전체 멤버 |
| POST | `/customers` | 생성 | 전체 멤버 |
| GET | `/customers/:id` | 상세 조회 | 전체 멤버 |
| PATCH | `/customers/:id` | 수정 | 전체 멤버 |
| DELETE | `/customers/:id` | 소프트 삭제 | ADMIN+ |

#### `GET /customers` 쿼리 파라미터
- `type?: CustomerType`
- `isActive?: boolean` (기본: 삭제되지 않은 전체)
- `q?: string` — 이름/상호 검색
- `page?: number`, `limit?: number` (기본: 20)

#### `POST /customers` 요청 Body

**INDIVIDUAL:**
```json
{
  "type": "INDIVIDUAL",
  "memo": "...",
  "individualProfile": {
    "name": "홍길동",
    "phone": "010-1234-5678",
    "email": "...",
    "address": {
      "zonecode": "12345",
      "address": "서울시 강남구 ...",
      "addressDetail": "101호"
    }
  }
}
```

**BUSINESS:**
```json
{
  "type": "BUSINESS",
  "memo": "...",
  "businessPartner": {
    "roles": ["SALES"],
    "memo": "...",
    "businessProfile": {
      "name": "(주)ABC",
      "businessRegistrationNo": "000-00-00000",
      "representativeName": "대표자",
      "businessType": "서비스업",
      "businessItem": "복합기 렌탈",
      "email": "...",
      "phone": "02-0000-0000",
      "address": {
        "zonecode": "12345",
        "address": "서울시 ...",
        "addressDetail": "5층"
      }
    },
    "contacts": [
      {
        "name": "김담당",
        "department": "총무팀",
        "position": "과장",
        "phone": "010-0000-0000",
        "isPrimary": true
      }
    ]
  }
}
```

트랜잭션 처리: `Address` → `BusinessProfile` → `BusinessPartner` → `Customer` 순 생성.

#### `GET /customers/:id` 응답

INDIVIDUAL 고객이면 `individualProfile` 포함, BUSINESS 고객이면 `businessPartner` (contacts[] 포함) 포함. 두 필드가 동시에 채워지지 않는다.

#### `PATCH /customers/:id` 요청 Body

- `memo?`, `isActive?`
- `individualProfile?: { name?, phone?, email?, address? }` — INDIVIDUAL 전용
- BusinessPartner 정보 수정은 `/business-partners/:id` 사용

---

### BusinessPartner (`/business-partners`)

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/business-partners` | 목록 조회 | 전체 멤버 |
| POST | `/business-partners` | 생성 | 전체 멤버 |
| GET | `/business-partners/:id` | 상세 (contacts[] 포함) | 전체 멤버 |
| PATCH | `/business-partners/:id` | 수정 | 전체 멤버 |
| DELETE | `/business-partners/:id` | 소프트 삭제 | ADMIN+ |
| POST | `/business-partners/:id/contacts` | 담당자 추가 | 전체 멤버 |
| PATCH | `/business-partners/:id/contacts/:cId` | 담당자 수정 | 전체 멤버 |
| DELETE | `/business-partners/:id/contacts/:cId` | 담당자 삭제 | ADMIN+ |

`GET /business-partners` 쿼리: `role?: BusinessPartnerRoleType`, `isActive?: boolean`, `q?: string`, `page?`, `limit?`

`PATCH /business-partners/:id`는 `BusinessProfile` 필드(name, phone 등)와 `roles?`, `memo?`, `isActive?` 모두 허용. Address 수정도 포함.

---

### CustomerAssignment (`/customers/:id/assignments`)

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/customers/:id/assignments` | 목록 | 전체 멤버 |
| POST | `/customers/:id/assignments` | 배정 | 전체 멤버 |
| PATCH | `/customers/:id/assignments/:aId` | 수정 | 전체 멤버 |
| DELETE | `/customers/:id/assignments/:aId` | 삭제 | ADMIN+ |

배정 시: `organizationMemberId`, `role?`, `isPrimary?`, `startedAt?`, `endedAt?`, `memo?`, `customerContactId?`, `individualProfileId?`

---

## Module Structure

```
src/customer/
├── customer.module.ts
├── customer/
│   ├── customer.service.ts
│   ├── customer.controller.ts
│   └── dto/
│       ├── create-customer.dto.ts          (discriminated union: INDIVIDUAL / BUSINESS)
│       ├── update-customer.dto.ts
│       └── query-customer.dto.ts
├── business-partner/
│   ├── business-partner.service.ts
│   ├── business-partner.controller.ts
│   └── dto/
│       ├── create-business-partner.dto.ts
│       ├── update-business-partner.dto.ts
│       ├── create-contact.dto.ts
│       └── update-contact.dto.ts
└── assignment/
    ├── assignment.service.ts
    ├── assignment.controller.ts
    └── dto/
        ├── create-assignment.dto.ts
        └── update-assignment.dto.ts
```

---

## Permissions Summary

| 작업 | 필요 권한 |
|------|----------|
| 조회 (목록/상세) | 모든 멤버 (`OrganizationGuard` 통과) |
| 생성 / 수정 | 모든 멤버 |
| 소프트 삭제 | ADMIN, OWNER (`@Roles(ADMIN, OWNER)`) |

---

## Constraints

- 모든 엔드포인트는 `OrganizationGuard` 적용 (`@OrgCtx()` 로 `organizationId` 주입)
- 삭제는 `deletedAt` 설정 (소프트 삭제 — 연결 데이터가 있어도 허용, 활성 상태 검증은 주문/계약 모듈에서 담당)
- `isActive: false`는 거래 정지 상태 — 조회는 가능하나 신규 주문에서 차단 (주문 모듈에서 검증)
- BusinessPartner 생성은 항상 `$transaction` (Address + BusinessProfile + BusinessPartner + Customer)
- `isPrimary` 배정 중복 방지: 새로 `isPrimary: true` 지정 시 기존 주담당자 자동 해제
