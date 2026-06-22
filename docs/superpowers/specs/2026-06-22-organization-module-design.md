# Organization Module 설계 문서

**날짜:** 2026-06-22
**브랜치:** `feature/api/organization`

---

## 1. 개요

Organization 도메인 구현. 사업자가 조직을 생성하고, 멤버를 직접 추가하거나 이메일로 초대하며, 로그인한 유저가 여러 조직 간에 전환할 수 있는 구조를 만든다. 이후 모든 도메인 엔드포인트는 `OrganizationGuard`를 통해 멀티테넌시 격리를 보장받는다.

---

## 2. 설계 결정

| 항목 | 결정 | 이유 |
|------|------|------|
| 멀티 소속 | 허용 — 유저 1명이 여러 조직에 소속 가능 | 프리랜서·겸직 직원 지원 |
| 조직 컨텍스트 전달 | `POST /auth/switch-org` → 새 Access Token에 `organizationId + role` 포함 | 매 요청 헤더 불필요, 토큰으로 컨텍스트 완결 |
| 조직 생성 시점 | 로그인 후 별도 `POST /organizations` 호출 | 직원은 초대로 합류하므로 가입 시 조직 불필요 |
| 멤버 합류 방식 | 직접 추가(기존 계정) + 이메일 초대(미가입 포함) 모두 지원 | — |
| 초대 토큰 저장 | `OrganizationInvitation` 별도 모델, SHA-256 해시 저장 | VerificationToken과 도메인 분리 |
| 멀티테넌시 격리 | `OrganizationGuard` — JWT `organizationId`로 활성 멤버 확인 후 `OrgContext` 첨부 | 이후 도메인 모듈 Guard 재사용 |

---

## 3. API 엔드포인트

### Organization
| Method | Path | Guard | 권한 | 설명 |
|--------|------|-------|------|------|
| `POST` | `/organizations` | JWT | 로그인 유저 | 조직 생성 (OWNER로 자동 등록) |
| `GET` | `/organizations/me` | JWT | 로그인 유저 | 내가 속한 조직 목록 |
| `GET` | `/organizations/:id` | JWT + OrgGuard | 멤버 | 조직 상세 조회 |
| `PATCH` | `/organizations/:id` | JWT + OrgGuard | OWNER·ADMIN | 조직 정보 수정 |

### Auth 추가
| Method | Path | Guard | 설명 |
|--------|------|-------|------|
| `POST` | `/auth/switch-org` | JWT | `organizationId` 받아 새 Access Token 발급 |

### 멤버 관리
| Method | Path | Guard | 권한 | 설명 |
|--------|------|-------|------|------|
| `GET` | `/organizations/:id/members` | JWT + OrgGuard | 멤버 | 활성 멤버 목록 |
| `POST` | `/organizations/:id/members` | JWT + OrgGuard | OWNER·ADMIN | 직접 추가 (기존 계정 이메일) |
| `PATCH` | `/organizations/:id/members/:memberId` | JWT + OrgGuard | OWNER·ADMIN | 역할·정보 수정 |
| `DELETE` | `/organizations/:id/members/:memberId` | JWT + OrgGuard | OWNER·ADMIN | 멤버 비활성화 (soft) |

### 초대
| Method | Path | Guard | 설명 |
|--------|------|-------|------|
| `POST` | `/organizations/:id/invitations` | JWT + OrgGuard (OWNER·ADMIN) | 초대 발송 (이메일) |
| `GET` | `/invitations/:token` | - | 초대 정보 조회 (public) |
| `POST` | `/invitations/:token/accept` | JWT | 로그인 유저가 초대 수락 |

---

## 4. 스키마 변경

### 신규 모델: OrganizationInvitation

```prisma
model OrganizationInvitation {
  id    String @id @default(uuid())
  token String @unique // SHA-256 해시 저장

  email          String
  role           OrganizationMemberRole @default(STAFF)

  organizationId String
  organization   Organization       @relation(fields: [organizationId], references: [id], onDelete: Restrict)

  invitedById    String
  invitedBy      OrganizationMember @relation(fields: [invitedById, organizationId], references: [id, organizationId], onDelete: Restrict)

  expiresAt  DateTime  // 초대 유효기간 (7일)
  acceptedAt DateTime? // 수락 시 설정

  createdAt DateTime @default(now())

  @@index([organizationId])
  @@index([email])
}
```

`Organization` 모델에 backrelation 추가:
```prisma
invitations OrganizationInvitation[]
```

### 마이그레이션
`20260622130000_organization_invitation`

---

## 5. JWT 변경

### 기존 JwtPayload
```typescript
interface JwtPayload {
  sub: string;       // accountId
  userId: string;
  email: string;
}
```

### 변경 후
```typescript
interface JwtPayload {
  sub: string;       // accountId
  userId: string;
  email: string;
  organizationId?: string;
  role?: OrganizationMemberRole;
}
```

`switch-org` 호출 전 토큰에는 `organizationId`/`role`이 없고, 호출 후 발급된 토큰에만 포함된다.

---

## 6. OrganizationGuard & 데코레이터

### OrganizationGuard
```
1. JWT에서 organizationId 추출 → 없으면 401
2. DB에서 OrganizationMember 조회 (userId + organizationId + isActive: true)
3. 없으면 403
4. req에 OrgContext { organizationId, memberId, role } 첨부
5. @Roles() 데코레이터가 있으면 role 검증
```

### 데코레이터
- `@Roles(...roles: OrganizationMemberRole[])` — 허용 역할 지정
- `@OrgContext()` — 컨트롤러 파라미터에서 `OrgContext` 추출

### OrgContext 인터페이스
```typescript
interface OrgContext {
  organizationId: string;
  memberId: string;
  role: OrganizationMemberRole;
}
```

---

## 7. 모듈 구조

```
src/
├── organization/
│   ├── organization.module.ts
│   ├── organization.service.ts        # 조직 생성/조회/수정
│   ├── organization.controller.ts
│   ├── member/
│   │   ├── member.service.ts          # 멤버 직접 추가/조회/수정/비활성화
│   │   └── member.controller.ts
│   └── invitation/
│       ├── invitation.service.ts      # 초대 발송/조회/수락
│       └── invitation.controller.ts
├── auth/                              # (기존) switch-org 엔드포인트 추가
└── common/
    ├── guards/
    │   └── organization.guard.ts
    └── decorators/
        ├── roles.decorator.ts
        └── org-context.decorator.ts
```

---

## 8. 핵심 플로우

### 조직 생성
```
POST /organizations
Body: { name, businessRegistrationNo, representativeName, businessType?, businessItem?,
        email?, phone?, zonecode, address, addressDetail?, memberName }
→ $transaction:
   1. Address 생성
   2. BusinessProfile 생성
   3. Organization 생성
   4. OrganizationMember 생성 (role: OWNER, isActive: true)
→ 201 { organizationId }
```

### 조직 전환
```
POST /auth/switch-org
Body: { organizationId }
→ OrganizationMember 조회 (userId + organizationId + isActive)
→ 없으면 403
→ 새 Access Token 발급 (organizationId + role 포함)
→ setAuthCookies (access_token만 갱신, refresh_token 유지)
→ 200
```

### 직접 멤버 추가
```
POST /organizations/:id/members
Body: { email, role, name, department?, position?, phone? }
→ Account.findUnique({ email }) → 없으면 404
→ OrganizationMember 이미 있으면 409
→ OrganizationMember 생성
→ 201
```

### 초대 발송
```
POST /organizations/:id/invitations
Body: { email, role }
→ 이미 활성 멤버면 409
→ rawToken 생성 → SHA-256 해시 저장
→ OrganizationInvitation 생성 (expiresAt: 7일)
→ mailService.sendOrganizationInvite(email, inviteUrl)
→ 201
```

### 초대 수락
```
POST /invitations/:token/accept
JWT 필요
→ tokenHash로 OrganizationInvitation 조회
→ 만료 또는 이미 수락 → 400
→ 이미 멤버면 409
→ OrganizationMember 생성 + acceptedAt 설정 ($transaction)
→ 200
```

---

## 9. 에러 처리

| 상황 | HTTP |
|------|------|
| switch-org: 비멤버 또는 비활성 | 403 |
| OrganizationGuard: organizationId 없음 | 401 |
| OrganizationGuard: 비멤버 | 403 |
| @Roles 불충족 | 403 |
| 직접 추가: 이메일 계정 없음 | 404 |
| 직접 추가: 이미 멤버 | 409 |
| 초대: 이미 활성 멤버 | 409 |
| 초대 수락: 만료·사용됨 | 400 |
| 초대 수락: 이미 멤버 | 409 |

---

## 10. IMailService 변경

`src/mail/mail.interface.ts`에 메서드 추가:
```typescript
sendOrganizationInvite(to: string, inviteUrl: string, organizationName: string): Promise<void>;
```
`NodemailerMailService`에 구현 및 Handlebars 템플릿(`organization-invite.hbs`) 추가.

---

## 11. 비즈니스 규칙

- **OWNER 보호**: OWNER 역할의 멤버는 비활성화·역할 변경 불가. 소유권 이전 기능은 이번 스코프 밖.
- **switch-org 쿠키**: access_token 쿠키만 새로 발급. refresh_token은 기존 것 유지.
- **초대 중복**: 동일 이메일로 pending 초대가 있어도 재발송 가능 (새 토큰으로 덮어씀).
- **직접 추가 vs 초대**: 직접 추가는 기존 Account만 가능. 초대는 미가입자 포함.

---

## 12. 환경 변수 추가

없음 (기존 `APP_URL`, `MAIL_*` 재사용).

---

## 13. 의존 패키지

추가 패키지 없음 (기존 Auth 모듈 인프라 재사용).
