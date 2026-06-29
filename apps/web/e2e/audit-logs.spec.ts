import { test, expect, type Page } from '@playwright/test';

const EMAIL = 'test@test.com';
const PASSWORD = 'Test1234!';
const API = 'http://localhost:3000';

async function login(page: Page) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.waitForURL('/');
}

// 감사로그를 유발하기 위해 invoice 1건 생성(CREATE 로그). 고객은 첫 번째 사용.
async function seedAuditLog(page: Page): Promise<void> {
  const res = await page.request.get(`${API}/customers`);
  const customers = (await res.json()) as Array<{ id: string }>;
  if (customers.length === 0) return;
  await page.request.post(`${API}/invoices`, { data: { type: 'MANUAL', customerId: customers[0].id } });
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('감사로그 목록 - 헤더/필터/컬럼이 보인다', async ({ page }) => {
  await login(page);
  await page.goto('/audit-logs');
  await expect(page.getByRole('heading', { name: '감사로그' })).toBeVisible();
  await expect(page.getByRole('button', { name: '생성', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '시각' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '행위자' })).toBeVisible();
});

test('감사로그 행 펼침 - 행을 클릭하면 변경 전/후 영역이 보인다', async ({ page }) => {
  await login(page);
  await seedAuditLog(page);
  await page.goto('/audit-logs');
  const firstRow = page.locator('tbody tr').first();
  await expect(firstRow).toBeVisible();
  await firstRow.click();
  await expect(page.getByText('변경 후').first()).toBeVisible();
});
