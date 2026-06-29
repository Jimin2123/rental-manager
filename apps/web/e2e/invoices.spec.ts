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

// 첫 고객 id 확보 (청구서 생성용)
async function firstCustomerId(page: Page): Promise<string> {
  const res = await page.request.get(`${API}/customers`);
  expect(res.ok()).toBeTruthy();
  const customers = (await res.json()) as Array<{ id: string }>;
  expect(customers.length).toBeGreaterThan(0);
  return customers[0].id;
}

// DRAFT 청구서를 API로 생성하고 id 반환
async function createDraftInvoice(page: Page): Promise<string> {
  const customerId = await firstCustomerId(page);
  const res = await page.request.post(`${API}/invoices`, { data: { type: 'MANUAL', customerId } });
  expect(res.ok()).toBeTruthy();
  const { id } = (await res.json()) as { id: string };
  return id;
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('청구서 목록 - 헤더/필터/컬럼이 보인다', async ({ page }) => {
  await login(page);
  await page.goto('/invoices');
  await expect(page.getByRole('heading', { name: '청구서' })).toBeVisible();
  // 필터 버튼 (타입/상태/수납 행에 공통으로 '전체'가 존재)
  await expect(page.getByRole('button', { name: '전체' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '월 렌탈' })).toBeVisible();
  await expect(page.getByRole('button', { name: '발행', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '미수납' })).toBeVisible();
  // 컬럼
  await expect(page.getByRole('columnheader', { name: '청구번호' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '고객' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '미수금' })).toBeVisible();
});

test('청구서 발행 - DRAFT를 발행하면 취소 버튼으로 전환된다', async ({ page }) => {
  await login(page);
  const id = await createDraftInvoice(page);

  await page.goto(`/invoices/${id}`);
  await expect(page.getByRole('heading', { name: '청구서 상세' })).toBeVisible();

  // DRAFT: 발행 버튼 노출, 취소 버튼 없음
  const issueBtn = page.getByRole('button', { name: '발행', exact: true });
  await expect(issueBtn).toBeVisible();
  await expect(page.getByRole('button', { name: '취소', exact: true })).toHaveCount(0);

  await issueBtn.click();
  await expect(page.getByText('청구서를 발행했습니다.')).toBeVisible();

  // ISSUED 전환: 발행 버튼 사라지고 취소 버튼 노출
  await expect(page.getByRole('button', { name: '발행', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '취소', exact: true })).toBeVisible();
});

test('청구서 취소 - ISSUED(미수납)를 취소하면 액션 버튼이 사라진다', async ({ page }) => {
  await login(page);
  const id = await createDraftInvoice(page);
  // API로 발행까지 처리 → 상세에서 취소만 검증
  const issueRes = await page.request.post(`${API}/invoices/${id}/issue`, { data: {} });
  expect(issueRes.ok()).toBeTruthy();

  await page.goto(`/invoices/${id}`);
  const cancelBtn = page.getByRole('button', { name: '취소', exact: true });
  await expect(cancelBtn).toBeVisible();

  await cancelBtn.click();
  await expect(page.getByText('청구서를 취소했습니다.')).toBeVisible();

  // CANCELED 전환: 발행/취소 버튼 모두 사라짐
  await expect(page.getByRole('button', { name: '발행', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '취소', exact: true })).toHaveCount(0);
});
