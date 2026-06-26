import { test, expect } from '@playwright/test';

// #78 회귀: 미인증 부트스트랩에서 /organizations/me·/auth/refresh를 호출하지 않는다.
// 세션 마커(localStorage 'rm_has_session')가 없으면 부트스트랩이 인증 조회를 건너뛴다.

const MOCK_ORGS = [{ id: 'org1', name: '테스트', businessRegistrationNo: '1234567890', role: 'OWNER' }];

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('미인증 첫 로드 시 /organizations/me·/auth/refresh를 호출하지 않는다', async ({ page }) => {
  const authCalls: string[] = [];
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('/organizations/me') || u.includes('/auth/refresh')) authCalls.push(`${r.method()} ${u}`);
  });

  await page.goto('/login');
  await expect(page.getByRole('button', { name: '로그인', exact: true })).toBeVisible();

  expect(authCalls).toEqual([]);
});

test('세션 마커가 있으면(복귀 사용자) /organizations/me를 호출한다', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('rm_has_session', '1'));
  await page.route('**/organizations/me', (route) => route.fulfill({ status: 200, body: JSON.stringify(MOCK_ORGS) }));
  await page.route('**/auth/switch-org', (route) => route.fulfill({ status: 200, body: '{}' }));

  let meCalled = false;
  page.on('request', (r) => {
    if (r.url().includes('/organizations/me')) meCalled = true;
  });

  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  expect(meCalled).toBe(true);
});

// #81 회귀: 소셜 OAuth는 서버가 쿠키로만 세션을 확립한다(클라이언트 setAuth 없음).
// 서버가 설정한 마커 쿠키(rm_has_session)만 있어도 부트스트랩이 인증 조회를 수행해야 한다.
test('서버 마커 쿠키만 있어도(소셜 OAuth 콜백 후) /organizations/me를 호출한다', async ({ page, context }) => {
  await context.addCookies([{ name: 'rm_has_session', value: '1', domain: 'localhost', path: '/' }]);
  await page.route('**/organizations/me', (route) => route.fulfill({ status: 200, body: JSON.stringify(MOCK_ORGS) }));
  await page.route('**/auth/switch-org', (route) => route.fulfill({ status: 200, body: '{}' }));

  let meCalled = false;
  page.on('request', (r) => {
    if (r.url().includes('/organizations/me')) meCalled = true;
  });

  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  expect(meCalled).toBe(true);
});
