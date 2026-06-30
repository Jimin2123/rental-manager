import { test, expect, type Page } from '@playwright/test';

// 입금계좌(설정 > 입금계좌) 관리 화면 E2E.
// members.spec과 동일하게 API를 라우트 모킹해 백엔드 없이 결정적으로 검증한다.

type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF';
type DepositAccount = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  label: string | null;
  isDefault: boolean;
  isActive: boolean;
  memo: string | null;
  createdAt: string;
};

function orgs(role: Role) {
  return [{ id: 'org1', name: '테스트', businessRegistrationNo: '1234567890', role }];
}

// 인증 + 입금계좌 API를 상태를 갖는 인메모리 목으로 대체한다.
// seed=true면 계좌 1건(기본)을 미리 넣는다.
async function mockApi(page: Page, role: Role = 'OWNER', seed = false) {
  let loggedIn = false;
  let seq = 0;
  const accounts: DepositAccount[] = [];
  if (seed) {
    accounts.push({
      id: `da-${++seq}`,
      bankName: '국민은행',
      accountNumber: '111-222-333',
      accountHolder: '김사장',
      label: null,
      isDefault: true,
      isActive: true,
      memo: null,
      createdAt: '2026-06-30T00:00:00.000Z',
    });
  }

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
  await page.route(/\/invitations\/mine$/, (route) => json(route, 200, []));
  await page.route(/\/invitations\/sent\/recent$/, (route) => json(route, 200, []));

  // 입금계좌 컬렉션: GET 목록 / POST 생성(첫 계좌는 자동 기본)
  await page.route(/\/deposit-accounts(\?.*)?$/, (route) => {
    const req = route.request();
    if (req.method() === 'POST') {
      const b = req.postDataJSON() as Partial<DepositAccount>;
      const created: DepositAccount = {
        id: `da-${++seq}`,
        bankName: b.bankName ?? '',
        accountNumber: b.accountNumber ?? '',
        accountHolder: b.accountHolder ?? '',
        label: b.label ?? null,
        isDefault: b.isDefault ?? accounts.length === 0,
        isActive: b.isActive ?? true,
        memo: b.memo ?? null,
        createdAt: new Date().toISOString(),
      };
      if (created.isDefault) accounts.forEach((a) => (a.isDefault = false));
      accounts.push(created);
      return json(route, 201, created);
    }
    return json(route, 200, accounts);
  });

  // 입금계좌 단건: PATCH 수정 / DELETE 소프트 삭제
  await page.route(/\/deposit-accounts\/[^/?]+$/, (route) => {
    const req = route.request();
    const id = req.url().split('/').pop()!.split('?')[0];
    const idx = accounts.findIndex((a) => a.id === id);
    if (idx < 0) return json(route, 404, { message: '없음' });
    if (req.method() === 'PATCH') {
      Object.assign(accounts[idx], req.postDataJSON());
      return json(route, 200, accounts[idx]);
    }
    accounts.splice(idx, 1); // DELETE = 목록에서 제거(소프트 삭제 효과)
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

test('STAFF 역할은 입금계좌 관리에 접근하면 안내 문구만 보인다', async ({ page }) => {
  await mockApi(page, 'STAFF');
  await login(page);
  await page.goto('/settings/deposit-accounts');
  await expect(page.getByText('입금계좌 관리는 관리자만 접근할 수 있습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '입금계좌 추가' })).toHaveCount(0);
});

test('OWNER가 입금계좌를 등록하면 목록에 표시되고 첫 계좌는 기본이 된다', async ({ page }) => {
  await mockApi(page, 'OWNER');
  await login(page);
  await page.goto('/settings/deposit-accounts');

  await expect(page.getByRole('link', { name: '입금계좌' })).toBeVisible();
  await expect(page.getByText('등록된 입금계좌가 없습니다.')).toBeVisible();

  await page.getByRole('button', { name: '입금계좌 추가' }).click();
  await page.getByLabel(/은행명/).fill('국민은행');
  await page.getByLabel(/계좌번호/).fill('123-456-7890');
  await page.getByLabel(/예금주/).fill('김사장');
  await page.getByRole('button', { name: '등록' }).click();

  await expect(page.getByText('입금계좌가 등록되었습니다.')).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: '국민은행' });
  await expect(row).toBeVisible();
  await expect(row.getByText('기본')).toBeVisible();
});

test('OWNER가 입금계좌를 삭제하면 목록에서 사라진다', async ({ page }) => {
  await mockApi(page, 'OWNER', true); // 계좌 1건 시드
  await login(page);
  await page.goto('/settings/deposit-accounts');

  const row = page.getByRole('row').filter({ hasText: '국민은행' });
  await expect(row).toBeVisible();

  await row.getByRole('button', { name: '삭제' }).click();
  await expect(page.getByText('입금계좌가 삭제되었습니다.')).toBeVisible();
  await expect(page.getByText('등록된 입금계좌가 없습니다.')).toBeVisible();
});
