import { test, expect } from '@playwright/test';

const EMAIL = 'test@test.com';
const PASSWORD = 'Test1234!';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL('/');
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

// ────────────────────────────────────────────
// 1. 로그인 플로우
// ────────────────────────────────────────────

test('유효한 자격증명으로 로그인하면 대시보드로 이동한다', async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible();
});

test('잘못된 비밀번호로 로그인하면 에러 토스트가 표시된다', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill('wrongpassword');
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page.getByText('이메일 또는 비밀번호가 올바르지 않습니다.')).toBeVisible();
  await expect(page).toHaveURL('/login');
});

test('이메일 형식이 올바르지 않으면 폼 유효성 검사 메시지가 표시된다', async ({ page }) => {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill('not-an-email');
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: '로그인' }).click();

  await expect(page.getByText('올바른 이메일을 입력해주세요.')).toBeVisible();
  await expect(page).toHaveURL('/login');
});

// ────────────────────────────────────────────
// 2. 세션 유지 (핵심 버그 회귀 테스트)
// ────────────────────────────────────────────

test('로그인 후 새로고침해도 대시보드에 머문다', async ({ page }) => {
  await login(page);
  await page.reload();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible();
});

test('로그인 후 보호된 페이지에서 새로고침해도 세션이 유지된다', async ({ page }) => {
  await login(page);
  await page.goto('/assets');
  await page.reload();
  await expect(page).toHaveURL('/assets');
  await expect(page.locator('text=로그인')).not.toBeVisible();
});

// ────────────────────────────────────────────
// 3. 보호된 라우트 접근 제어
// ────────────────────────────────────────────

test('비인증 상태에서 / 접근 시 로그인 페이지로 리다이렉트된다', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL('/login');
});

test('비인증 상태에서 /assets 접근 시 로그인 페이지로 리다이렉트된다', async ({ page }) => {
  await page.goto('/assets');
  await expect(page).toHaveURL('/login');
});

test('이미 로그인된 상태에서 /login 접근 시 대시보드로 리다이렉트된다', async ({ page }) => {
  await login(page);
  await page.goto('/login');
  await expect(page).toHaveURL('/');
});

// ────────────────────────────────────────────
// 4. 로그아웃
// ────────────────────────────────────────────

test('로그아웃하면 로그인 페이지로 이동하고 세션이 종료된다', async ({ page }) => {
  await login(page);

  // 헤더 아바타 클릭 → 로그아웃 메뉴
  await page.locator('header button[class*="rounded-full"]').click();
  await page.getByRole('menuitem', { name: '로그아웃' }).click();

  await expect(page).toHaveURL('/login');
  await expect(page.getByText('로그아웃되었습니다.')).toBeVisible();

  // 로그아웃 후 / 접근 시 다시 /login으로
  await page.goto('/');
  await expect(page).toHaveURL('/login');
});

// ────────────────────────────────────────────
// 5. 사이드바 네비게이션
// ────────────────────────────────────────────

test('대시보드 페이지에서만 대시보드 링크가 active 상태다', async ({ page }) => {
  await login(page);

  const dashboardLink = page.getByRole('link', { name: '대시보드' });
  await expect(dashboardLink).toHaveAttribute('aria-current', 'page');

  // 다른 페이지로 이동하면 대시보드 링크가 active 아님
  await page.getByRole('link', { name: '자산' }).click();
  await expect(page).toHaveURL('/assets');
  await expect(dashboardLink).not.toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: '자산' })).toHaveAttribute('aria-current', 'page');
});

test('사이드바 네비게이션으로 모든 보호된 페이지를 이동할 수 있다', async ({ page }) => {
  await login(page);

  const routes: Array<{ label: string; url: string }> = [
    { label: '계약', url: '/contracts' },
    { label: '청구서', url: '/invoices' },
    { label: '수납', url: '/payments' },
    { label: '환불', url: '/refunds' },
    { label: '자산', url: '/assets' },
    { label: '고객', url: '/customers' },
  ];

  for (const { label, url } of routes) {
    await page.getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(url);
  }
});
