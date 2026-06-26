import { test, expect, type Page } from '@playwright/test';

// 직원(조직 멤버) 관리 화면 E2E.
// 멤버 추가는 초대로 일원화되었으므로(직접추가 제거) 초대 발송/대기목록 중심으로 검증한다.
// register/social 스펙과 동일하게 API를 라우트 모킹해 백엔드 없이 결정적으로 검증한다.

type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF';
type Member = {
  id: string;
  userId: string;
  role: Role;
  name: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
};
type Invitation = {
  id: string;
  email: string;
  role: Role;
  expiresAt: string;
  createdAt: string;
  invitedBy: { name: string };
  status: 'PENDING' | 'DECLINED' | 'EXPIRED';
};

function orgs(role: Role) {
  return [{ id: 'org1', name: '테스트', businessRegistrationNo: '1234567890', role }];
}

const STAFF_MEMBER: Member = {
  id: 'm-staff',
  userId: 'u-staff',
  role: 'STAFF',
  name: '이직원',
  department: null,
  position: null,
  phone: null,
  email: null,
  isActive: true,
};

// 조직 멤버/초대 API를 상태를 갖는 인메모리 목으로 대체한다.
// seedStaff=true면 STAFF 멤버 1명을 미리 넣는다(직접추가가 없으므로 수정/비활성화 테스트용).
async function mockMembersApi(page: Page, role: Role = 'OWNER', seedStaff = false) {
  let loggedIn = false;
  const members: Member[] = [
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
  ];
  if (seedStaff) members.push({ ...STAFF_MEMBER });
  const invitations: Invitation[] = [];
  let seq = 0;

  const json = (route: Parameters<Parameters<Page['route']>[1]>[0], status: number, body: unknown) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route(/\/organizations\/me$/, (route) =>
    loggedIn ? json(route, 200, orgs(role)) : route.fulfill({ status: 401 }),
  );
  await page.route(/\/auth\/login$/, (route) => {
    loggedIn = true;
    return json(route, 200, orgs(role));
  });
  await page.route(/\/auth\/switch-org$/, (route) => json(route, 200, { message: 'ok' }));
  await page.route(/\/auth\/refresh$/, (route) => route.fulfill({ status: 401 }));

  // 헤더 InvitationBell이 모든 로그인 페이지에서 호출하는 쿼리(미모킹 시 401→로그아웃)
  await page.route(/\/invitations\/mine$/, (route) => json(route, 200, []));
  await page.route(/\/invitations\/sent\/recent$/, (route) => json(route, 200, []));

  // 멤버 컬렉션: GET 목록만 (직접추가 제거됨)
  await page.route(/\/organizations\/[^/]+\/members$/, (route) =>
    json(
      route,
      200,
      members.filter((m) => m.isActive),
    ),
  );

  // 멤버 단건: PATCH 수정 / DELETE 비활성화
  await page.route(/\/organizations\/[^/]+\/members\/[^/]+$/, (route) => {
    const req = route.request();
    const id = req.url().split('/').pop()!;
    const m = members.find((x) => x.id === id);
    if (!m) return json(route, 404, { message: '없음' });
    if (req.method() === 'PATCH') {
      Object.assign(m, req.postDataJSON());
      return json(route, 200, m);
    }
    m.isActive = false; // DELETE = soft 비활성화
    return json(route, 200, {});
  });

  // 초대 컬렉션: GET 대기목록(status 포함) / POST 발송
  await page.route(/\/organizations\/[^/]+\/invitations$/, (route) => {
    const req = route.request();
    if (req.method() === 'GET') return json(route, 200, invitations);
    const b = req.postDataJSON() as { email: string; role: Role };
    invitations.push({
      id: `inv-${++seq}`,
      email: b.email,
      role: b.role,
      expiresAt: '2026-07-03T00:00:00.000Z',
      createdAt: '2026-06-26T00:00:00.000Z',
      invitedBy: { name: '김사장' },
      status: 'PENDING',
    });
    return json(route, 201, {});
  });

  // 초대 재발송
  await page.route(/\/organizations\/[^/]+\/invitations\/[^/]+\/resend$/, (route) => json(route, 200, {}));
  // 초대 취소
  await page.route(/\/organizations\/[^/]+\/invitations\/[^/]+$/, (route) => {
    const id = route.request().url().split('/').pop()!;
    const i = invitations.findIndex((x) => x.id === id);
    if (i >= 0) invitations.splice(i, 1);
    return json(route, 200, {});
  });
}

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('owner@test.com');
  await page.locator('input[type="password"]').fill('Test1234!');
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.waitForURL('/');
}

/** 초대 다이얼로그를 열어 이메일로 초대를 발송한다(역할 기본 STAFF). */
async function sendInvite(page: Page, email: string) {
  await page.getByRole('button', { name: /직원 추가/ }).click();
  const dlg = page.getByRole('dialog');
  await expect(dlg.getByRole('heading', { name: '직원 초대' })).toBeVisible();
  await dlg.getByPlaceholder('staff@company.com').fill(email);
  await dlg.getByRole('button', { name: '초대 보내기' }).click();
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

// ────────────────────────────────────────────
// 1. 권한 게이트
// ────────────────────────────────────────────

test('STAFF 역할은 직원 관리에 접근하면 안내 문구만 보인다', async ({ page }) => {
  await mockMembersApi(page, 'STAFF');
  await login(page);
  await page.goto('/settings/members');
  await expect(page.getByText('직원 관리는 관리자만 접근할 수 있습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: /직원 추가/ })).toHaveCount(0);
});

// ────────────────────────────────────────────
// 2. 목록 + OWNER 보호
// ────────────────────────────────────────────

test('OWNER는 설정 탭과 직원 목록을 보고, OWNER 행에는 액션이 없다', async ({ page }) => {
  await mockMembersApi(page, 'OWNER');
  await login(page);
  await page.goto('/settings/members');

  await expect(page.getByRole('link', { name: '직원 관리' })).toBeVisible();
  await expect(page.getByText('직원 (1명)')).toBeVisible();

  const ownerRow = page.getByRole('row').filter({ hasText: '김사장' });
  await expect(ownerRow.getByText('사업자')).toBeVisible();
  await expect(ownerRow.getByRole('button', { name: '수정' })).toHaveCount(0);
  await expect(ownerRow.getByRole('button', { name: '비활성화' })).toHaveCount(0);
});

// ────────────────────────────────────────────
// 3. 초대 발송 (직접추가 일원화)
// ────────────────────────────────────────────

test('직원 초대를 발송하면 대기 중 초대 목록에 나타난다', async ({ page }) => {
  await mockMembersApi(page, 'OWNER');
  await login(page);
  await page.goto('/settings/members');

  await sendInvite(page, 'staff@test.com');

  await expect(page.getByText('초대장을 보냈습니다.')).toBeVisible();
  const pending = page.locator('li').filter({ hasText: 'staff@test.com' });
  await expect(pending).toBeVisible();
  await expect(page.getByText('대기 중 초대 (1)')).toBeVisible();
});

// ────────────────────────────────────────────
// 4. 수정 + 비활성화 (사전 시드된 STAFF 멤버 대상)
// ────────────────────────────────────────────

test('직원을 수정하면 이름이 갱신되고, 비활성화하면 목록에서 사라진다', async ({ page }) => {
  await mockMembersApi(page, 'OWNER', true); // STAFF 멤버 '이직원' 시드
  await login(page);
  await page.goto('/settings/members');

  const row = page.getByRole('row').filter({ hasText: '이직원' });
  await expect(row).toBeVisible();

  // 수정
  await row.getByRole('button', { name: '수정' }).click();
  const dlg = page.getByRole('dialog');
  await dlg.locator('input').first().fill('이직원수정');
  await dlg.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('직원 정보가 수정되었습니다.')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: '이직원수정' })).toBeVisible();

  // 비활성화
  await page.getByRole('row').filter({ hasText: '이직원수정' }).getByRole('button', { name: '비활성화' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '비활성화' }).click();
  await expect(page.getByText('직원이 비활성화되었습니다.')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: '이직원수정' })).toHaveCount(0);
});

// ────────────────────────────────────────────
// 5. 대기 초대 재발송 / 취소
// ────────────────────────────────────────────

test('대기 중 초대를 재발송하고 취소할 수 있다', async ({ page }) => {
  await mockMembersApi(page, 'OWNER');
  await login(page);
  await page.goto('/settings/members');

  await sendInvite(page, 'invitee@test.com');

  const pending = page.locator('li').filter({ hasText: 'invitee@test.com' });
  await expect(pending).toBeVisible();

  // 재발송
  await pending.getByRole('button', { name: '재발송' }).click();
  await expect(page.getByText('초대장을 다시 보냈습니다.')).toBeVisible();

  // 취소
  await page.locator('li').filter({ hasText: 'invitee@test.com' }).getByRole('button', { name: '취소' }).click();
  await expect(page.getByText('초대를 취소했습니다.')).toBeVisible();
  await expect(page.locator('li').filter({ hasText: 'invitee@test.com' })).toHaveCount(0);
  await expect(page.getByText('대기 중인 초대가 없습니다.')).toBeVisible();
});
