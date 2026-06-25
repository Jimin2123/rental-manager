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

test('거래처 목록 페이지 - 테이블과 등록 버튼이 표시된다', async ({ page }) => {
  await login(page);
  await page.goto('/business-partners');
  await expect(page.getByRole('heading', { name: '거래처' })).toBeVisible();
  await expect(page.getByRole('button', { name: '거래처 등록' })).toBeVisible();
  await expect(page.getByPlaceholder('상호명 검색')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '상호명' })).toBeVisible();
});

test('거래처 목록 - 역할 필터 버튼이 표시된다', async ({ page }) => {
  await login(page);
  await page.goto('/business-partners');
  await expect(page.getByRole('button', { name: '전체' })).toBeVisible();
  await expect(page.getByRole('button', { name: '매출' })).toBeVisible();
  await expect(page.getByRole('button', { name: '매입' })).toBeVisible();
});
