import { test, expect, type Page } from '@playwright/test';

// 직원(조직 멤버) 관리 화면 E2E.
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

// 가입 계정이 없어 직접 추가가 404 → 초대로 폴백되는 이메일
const NO_ACCOUNT_EMAIL = 'noaccount@test.com';

function orgs(role: Role) {
  return [{ id: 'org1', name: '테스트', businessRegistrationNo: '1234567890', role }];
}

// 조직 멤버/초대 API를 상태를 갖는 인메모리 목으로 대체한다.
async function mockMembersApi(page: Page, role: Role = 'OWNER') {
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
  type Invitation = {
    id: string;
    email: string;
    role: Role;
    expiresAt: string;
    createdAt: string;
    invitedBy: { name: string };
  };
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

  // 멤버 컬렉션: GET 목록 / POST 직접 추가(미가입 이메일이면 404)
  await page.route(/\/organizations\/[^/]+\/members$/, (route) => {
    const req = route.request();
    if (req.method() === 'GET')
      return json(
        route,
        200,
        members.filter((m) => m.isActive),
      );
    const b = req.postDataJSON() as { email: string; role: Role; name: string; department?: string; position?: string };
    if (b.email === NO_ACCOUNT_EMAIL) return json(route, 404, { message: '해당 이메일로 가입된 계정이 없습니다.' });
    const m: Member = {
      id: `m-${++seq}`,
      userId: `u-${seq}`,
      role: b.role,
      name: b.name,
      department: b.department ?? null,
      position: b.position ?? null,
      phone: null,
      email: null,
      isActive: true,
    };
    members.push(m);
    return json(route, 201, m);
  });

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

  // 초대 컬렉션: GET 대기목록 / POST 발송
  await page.route(/\/organizations\/[^/]+\/invitations$/, (route) => {
    const req = route.request();
    if (req.method() === 'GET') return json(route, 200, invitations);
    const b = req.postDataJSON() as { email: string; role: Role };
    const inv: Invitation = {
      id: `inv-${++seq}`,
      email: b.email,
      role: b.role,
      expiresAt: '2026-07-03T00:00:00.000Z',
      createdAt: '2026-06-26T00:00:00.000Z',
      invitedBy: { name: '김사장' },
    };
    invitations.push(inv);
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
// 3. 직접 추가
// ────────────────────────────────────────────

test('가입된 이메일로 직접 추가하면 목록에 직원이 나타난다', async ({ page }) => {
  await mockMembersApi(page, 'OWNER');
  await login(page);
  await page.goto('/settings/members');

  await page.getByRole('button', { name: /직원 추가/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByPlaceholder('staff@company.com').fill('staff@test.com');
  await dlg.getByPlaceholder('홍길동').fill('이직원');
  await dlg.getByRole('button', { name: '추가', exact: true }).click();

  await expect(page.getByText('직원이 추가되었습니다.')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: '이직원' })).toBeVisible();
  await expect(page.getByText('직원 (2명)')).toBeVisible();
});

// ────────────────────────────────────────────
// 4. 초대 폴백 (미가입 이메일)
// ────────────────────────────────────────────

test('미가입 이메일은 404 → 초대 확인 모드로 전환되고 발송 시 대기 목록에 나타난다', async ({ page }) => {
  await mockMembersApi(page, 'OWNER');
  await login(page);
  await page.goto('/settings/members');

  await page.getByRole('button', { name: /직원 추가/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByPlaceholder('staff@company.com').fill(NO_ACCOUNT_EMAIL);
  await dlg.getByPlaceholder('홍길동').fill('초대대상');
  await dlg.getByRole('button', { name: '추가', exact: true }).click();

  // 초대 확인 모드 전환
  const invite = page.getByRole('dialog');
  await expect(invite.getByRole('heading', { name: '초대장 보내기' })).toBeVisible();
  await expect(invite.getByText(NO_ACCOUNT_EMAIL)).toBeVisible();
  await invite.getByRole('button', { name: '초대 보내기' }).click();

  await expect(page.getByText('초대장을 보냈습니다.')).toBeVisible();
  const pending = page.locator('li').filter({ hasText: NO_ACCOUNT_EMAIL });
  await expect(pending).toBeVisible();
  await expect(page.getByText('대기 중 초대 (1)')).toBeVisible();
});

// ────────────────────────────────────────────
// 5. 수정 + 비활성화
// ────────────────────────────────────────────

test('직원을 수정하면 이름이 갱신되고, 비활성화하면 목록에서 사라진다', async ({ page }) => {
  await mockMembersApi(page, 'OWNER');
  await login(page);
  await page.goto('/settings/members');

  // 먼저 직원 1명 추가
  await page.getByRole('button', { name: /직원 추가/ }).click();
  let dlg = page.getByRole('dialog');
  await dlg.getByPlaceholder('staff@company.com').fill('staff@test.com');
  await dlg.getByPlaceholder('홍길동').fill('이직원');
  await dlg.getByRole('button', { name: '추가', exact: true }).click();
  const row = page.getByRole('row').filter({ hasText: '이직원' });
  await expect(row).toBeVisible();

  // 수정
  await row.getByRole('button', { name: '수정' }).click();
  dlg = page.getByRole('dialog');
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
// 6. 대기 초대 재발송 / 취소
// ────────────────────────────────────────────

test('대기 중 초대를 재발송하고 취소할 수 있다', async ({ page }) => {
  await mockMembersApi(page, 'OWNER');
  await login(page);
  await page.goto('/settings/members');

  // 초대 1건 생성
  await page.getByRole('button', { name: /직원 추가/ }).click();
  const dlg = page.getByRole('dialog');
  await dlg.getByPlaceholder('staff@company.com').fill(NO_ACCOUNT_EMAIL);
  await dlg.getByPlaceholder('홍길동').fill('초대대상');
  await dlg.getByRole('button', { name: '추가', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '초대 보내기' }).click();

  const pending = page.locator('li').filter({ hasText: NO_ACCOUNT_EMAIL });
  await expect(pending).toBeVisible();

  // 재발송
  await pending.getByRole('button', { name: '재발송' }).click();
  await expect(page.getByText('초대장을 다시 보냈습니다.')).toBeVisible();

  // 취소
  await page.locator('li').filter({ hasText: NO_ACCOUNT_EMAIL }).getByRole('button', { name: '취소' }).click();
  await expect(page.getByText('초대를 취소했습니다.')).toBeVisible();
  await expect(page.locator('li').filter({ hasText: NO_ACCOUNT_EMAIL })).toHaveCount(0);
  await expect(page.getByText('대기 중인 초대가 없습니다.')).toBeVisible();
});
