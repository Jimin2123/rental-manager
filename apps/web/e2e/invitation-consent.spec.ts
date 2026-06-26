import { test, expect, type Page } from '@playwright/test';

// 초대 수락/거절 흐름 E2E.
// register/members 스펙과 동일하게 API를 라우트 모킹해 백엔드 없이 결정적으로 검증한다.

// ────────────────────────────────────────────
// 공통 픽스처
// ────────────────────────────────────────────

const MOCK_ORGS = [{ id: 'org1', name: '테스트회사', businessRegistrationNo: '1234567890', role: 'OWNER' as const }];

/** GET /invitations/:token 응답 형태 */
const MOCK_TOKEN_INVITATION = {
  id: 'inv-tok1',
  email: 'staff@test.com',
  role: 'STAFF',
  organization: { businessProfile: { name: '테스트회사', businessRegistrationNo: '1234567890' } },
};

/** GET /invitations/mine 항목 1건 */
const MOCK_MINE_INVITATION = {
  id: 'inv-mine-1',
  role: 'STAFF',
  expiresAt: '2026-07-27T00:00:00.000Z',
  organization: { businessProfile: { name: '테스트회사' } },
  invitedBy: { name: '김사장' },
};

/** GET /organizations/:id/invitations 항목 — PENDING·DECLINED·EXPIRED 각 1건 */
const MOCK_ADMIN_INVITATIONS = [
  {
    id: 'inv-pending',
    email: 'pending@test.com',
    role: 'STAFF',
    expiresAt: '2026-07-27T00:00:00.000Z',
    createdAt: '2026-06-27T00:00:00.000Z',
    invitedBy: { name: '김사장' },
    status: 'PENDING',
  },
  {
    id: 'inv-declined',
    email: 'declined@test.com',
    role: 'STAFF',
    expiresAt: '2026-06-30T00:00:00.000Z',
    createdAt: '2026-06-20T00:00:00.000Z',
    invitedBy: { name: '김사장' },
    status: 'DECLINED',
  },
  {
    id: 'inv-expired',
    email: 'expired@test.com',
    role: 'STAFF',
    expiresAt: '2026-06-15T00:00:00.000Z',
    createdAt: '2026-06-10T00:00:00.000Z',
    invitedBy: { name: '김사장' },
    status: 'EXPIRED',
  },
];

type RouteParam = Parameters<Parameters<Page['route']>[1]>[0];

const json = (route: RouteParam, status: number, body: unknown) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * 로그인된 세션 시뮬레이션.
 * - localStorage rm_has_session='1' → 부트스트랩이 /organizations/me 호출
 * - /organizations/me → MOCK_ORGS (OWNER)
 * - /auth/switch-org → 200
 * members.spec.ts의 mockMembersApi 패턴과 동일하다.
 */
async function mockLoggedIn(page: Page) {
  await page.addInitScript(() => localStorage.setItem('rm_has_session', '1'));
  await page.route(/\/organizations\/me$/, (route) => json(route, 200, MOCK_ORGS));
  await page.route(/\/auth\/switch-org$/, (route) => json(route, 200, {}));
  // 헤더의 InvitationBell이 모든 로그인 페이지에서 호출하는 쿼리 — 모킹하지 않으면
  // 실 API 401 → 인터셉터 clearAuth → 로그아웃되어 페이지가 사라진다. (개별 테스트가 덮어쓸 수 있음)
  await page.route(/\/invitations\/mine$/, (route) => json(route, 200, []));
  await page.route(/\/invitations\/sent\/recent$/, (route) => json(route, 200, []));
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

// ────────────────────────────────────────────
// 1. 미가입 수락 페이지
// ────────────────────────────────────────────

test('미가입자: 초대 수락 페이지에서 이메일 가입 후 대시보드로 이동한다', async ({ page }) => {
  // signup-accept 완료 후 organizations/me가 orgs를 반환할 수 있도록 상태 플래그 사용
  let signedUp = false;

  // organizations/me: 최초 로드 시 401(미인증), signup-accept 완료 후 MOCK_ORGS 반환
  await page.route(/\/organizations\/me$/, (route) => json(route, signedUp ? 200 : 401, signedUp ? MOCK_ORGS : {}));
  await page.route(/\/auth\/switch-org$/, (route) => json(route, 200, {}));

  // GET /invitations/:token — 초대 상세 (일반 패턴, 먼저 등록)
  // 이 정규식은 페이지 문서(/invitations/accept?token=...)와 vite 모듈 스크립트
  // (/src/routes/invitations/accept.tsx)도 매칭하므로, 실제 API(xhr/fetch)만 모킹하고
  // 나머지(document·script 등)는 통과시켜 SPA가 정상 로드되게 한다.
  await page.route(/\/invitations\/[^/]+$/, (route) => {
    const rt = route.request().resourceType();
    if (rt !== 'xhr' && rt !== 'fetch') return route.continue();
    return json(route, 200, MOCK_TOKEN_INVITATION);
  });

  // POST /invitations/:token/signup-accept — 더 구체적인 패턴이므로 나중에 등록 (Playwright는 마지막 등록 라우트 우선)
  // signup-accept 성공 시 rm_has_session=1 쿠키를 Set-Cookie로 심어
  // 페이지 리로드 후 부트스트랩이 organizations/me를 호출하도록 한다.
  await page.route(/\/invitations\/[^/]+\/signup-accept$/, async (route) => {
    signedUp = true;
    await route.fulfill({
      status: 200,
      headers: { 'set-cookie': 'rm_has_session=1; Path=/' },
      contentType: 'application/json',
      body: '{}',
    });
  });

  await page.goto('/invitations/accept?token=tok1');

  // 미로그인 상태 → GuestActions 가입 탭 노출 확인
  await expect(page.getByRole('button', { name: '이메일로 가입' })).toBeVisible();

  // 초대 조직 정보 확인
  await expect(page.getByText('테스트회사')).toBeVisible();

  // 폼 작성: email은 초대 이메일(staff@test.com)으로 미리 채워짐
  await page.getByPlaceholder('홍길동').fill('홍길동');
  await page.locator('input[type="password"]').fill('Test1234!');

  // 제출
  await page.getByRole('button', { name: '가입하고 합류하기' }).click();

  // 가입 완료 후 대시보드('/')로 이동 확인
  await page.waitForURL('/');
  await expect(page).toHaveURL('/');
});

// ────────────────────────────────────────────
// 2. 만료 토큰 상태
// ────────────────────────────────────────────

test('만료 토큰: 초대 수락 페이지에서 만료 오류 메시지가 표시된다', async ({ page }) => {
  // GET /invitations/:token → 400 (만료된 초대)
  // AcceptInvitationPage는 response.data.message를 ErrorScreen에 그대로 표시한다.
  await page.route(/\/invitations\/[^/]+$/, (route) => {
    const rt = route.request().resourceType();
    if (rt !== 'xhr' && rt !== 'fetch') return route.continue();
    return route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ message: '만료된 초대입니다.' }),
    });
  });

  await page.goto('/invitations/accept?token=expired');

  // 서버가 반환한 오류 메시지 확인
  await expect(page.getByText('만료된 초대입니다.')).toBeVisible();
});

// ────────────────────────────────────────────
// 3. 로그인 사용자 헤더 벨
// ────────────────────────────────────────────

test('로그인 사용자: 헤더 벨에서 초대를 수락하면 목록이 비워진다', async ({ page }) => {
  await mockLoggedIn(page);

  let accepted = false;

  // GET /invitations/mine — 수락 전 1건, 수락 후 빈 목록
  // /invitations\/mine$/ 는 /invitations/mine/inv1/accept$ 와 disjoint($ 앵커로 분리됨)
  await page.route(/\/invitations\/mine$/, (route) => json(route, 200, accepted ? [] : [MOCK_MINE_INVITATION]));

  // GET /invitations/sent/recent → 빈 목록 (보낸 결과 섹션)
  await page.route(/\/invitations\/sent\/recent$/, (route) => json(route, 200, []));

  // POST /invitations/mine/:id/accept
  await page.route(/\/invitations\/mine\/[^/]+\/accept$/, async (route) => {
    accepted = true;
    await json(route, 200, {});
  });

  await page.goto('/');

  // 헤더 벨 버튼 클릭 (InvitationBell, aria-label="초대 알림")
  await page.getByRole('button', { name: '초대 알림' }).click();

  // 받은 초대 1건의 수락/거절 버튼이 드롭다운에 노출되는지 확인
  const acceptBtn = page.getByRole('button', { name: '수락' });
  await expect(acceptBtn).toBeVisible();

  // 수락 버튼 클릭
  await acceptBtn.click();

  // 수락 성공 토스트 (InvitationBell → toast.success('초대를 수락했습니다.'))
  await expect(page.getByText('초대를 수락했습니다.')).toBeVisible();

  // invalidateMine 후 재조회 → 빈 목록 → "받은 초대가 없습니다." 표시 확인
  await expect(page.getByText('받은 초대가 없습니다.')).toBeVisible();
});

// ────────────────────────────────────────────
// 4. 관리자 초대 상태 배지
// ────────────────────────────────────────────

test('관리자: 초대 목록에서 상태 배지(대기·거절됨·만료됨)와 재발송·취소 버튼이 표시된다', async ({ page }) => {
  await mockLoggedIn(page);

  // GET /organizations/:id/members → OWNER 1명 (MemberTable 렌더)
  await page.route(/\/organizations\/[^/]+\/members$/, (route) =>
    json(route, 200, [
      {
        id: 'm-owner',
        userId: 'u-owner',
        role: 'OWNER',
        name: '김사장',
        department: null,
        position: null,
        phone: null,
        email: null,
        isActive: true,
      },
    ]),
  );

  // GET /organizations/:id/invitations → PENDING·DECLINED·EXPIRED 각 1건 (PendingInvitations 렌더)
  // /members$ 와 /invitations$ 는 URL 끝이 달라 충돌 없음
  await page.route(/\/organizations\/[^/]+\/invitations$/, (route) => json(route, 200, MOCK_ADMIN_INVITATIONS));

  await page.goto('/settings/members');

  // PendingInvitations 상태 배지 확인
  // STATUS_LABEL: PENDING→'대기', DECLINED→'거절됨', EXPIRED→'만료됨'
  await expect(page.getByText('대기', { exact: true })).toBeVisible();
  await expect(page.getByText('거절됨', { exact: true })).toBeVisible();
  await expect(page.getByText('만료됨', { exact: true })).toBeVisible();

  // 재발송·취소 버튼 존재 확인
  await expect(page.getByRole('button', { name: '재발송' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '취소' }).first()).toBeVisible();
});
