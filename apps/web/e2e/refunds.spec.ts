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

async function firstCustomerId(page: Page): Promise<string> {
  const res = await page.request.get(`${API}/customers`);
  const customers = (await res.json()) as Array<{ id: string }>;
  expect(customers.length).toBeGreaterThan(0);
  return customers[0].id;
}

async function createPayment(page: Page): Promise<{ customerId: string; paymentId: string }> {
  const customerId = await firstCustomerId(page);
  const res = await page.request.post(`${API}/payments`, {
    data: { customerId, method: 'CASH', amount: 10000, paidAt: new Date().toISOString() },
  });
  const { id } = (await res.json()) as { id: string };
  return { customerId, paymentId: id };
}

async function createRefund(page: Page): Promise<string> {
  const { customerId, paymentId } = await createPayment(page);
  const res = await page.request.post(`${API}/refunds`, {
    data: { customerId, paymentId, reason: 'OVERPAYMENT', amount: 1000 },
  });
  expect(res.ok()).toBeTruthy();
  const { id } = (await res.json()) as { id: string };
  return id;
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('환불 목록 - 헤더/필터/컬럼이 보인다', async ({ page }) => {
  await login(page);
  await page.goto('/refunds');
  await expect(page.getByRole('heading', { name: '환불' })).toBeVisible();
  await expect(page.getByRole('button', { name: '환불 등록' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '환불번호' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '사유' })).toBeVisible();
});

test('환불 완료 - PENDING을 완료하면 액션 버튼이 사라진다', async ({ page }) => {
  await login(page);
  const id = await createRefund(page);
  await page.goto(`/refunds/${id}`);
  const completeBtn = page.getByRole('button', { name: '완료' });
  await expect(completeBtn).toBeVisible();
  await completeBtn.click();
  await expect(page.getByText('환불을 완료 처리했습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '완료' })).toHaveCount(0);
});

test('환불 취소 - PENDING을 취소하면 액션 버튼이 사라진다', async ({ page }) => {
  await login(page);
  const id = await createRefund(page);
  await page.goto(`/refunds/${id}`);
  const cancelBtn = page.getByRole('button', { name: '취소' });
  await expect(cancelBtn).toBeVisible();
  await cancelBtn.click();
  await expect(page.getByText('환불을 취소했습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '취소' })).toHaveCount(0);
});
