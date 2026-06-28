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

// 사업자(법인) 고객 id 확보 — businessPartner 있는 고객.
async function businessCustomerId(page: Page): Promise<string> {
  const res = await page.request.get(`${API}/customers`);
  expect(res.ok()).toBeTruthy();
  const customers = (await res.json()) as Array<{ id: string; businessPartner: unknown | null }>;
  const biz = customers.find((c) => c.businessPartner !== null);
  expect(biz, '사업자 고객이 최소 1명 필요').toBeTruthy();
  return biz!.id;
}

// 항목 있는 ISSUED 청구서를 만들고 invoiceId 반환
async function createIssuedInvoice(page: Page): Promise<string> {
  const customerId = await businessCustomerId(page);
  const inv = await page.request.post(`${API}/invoices`, { data: { type: 'MANUAL', customerId } });
  expect(inv.ok()).toBeTruthy();
  const { id } = (await inv.json()) as { id: string };
  const item = await page.request.post(`${API}/invoices/${id}/items`, {
    data: { type: 'ETC', quantity: 1, unitPrice: 100000, description: '테스트 항목' },
  });
  expect(item.ok()).toBeTruthy();
  const issued = await page.request.post(`${API}/invoices/${id}/issue`, { data: {} });
  expect(issued.ok()).toBeTruthy();
  return id;
}

// 세금계산서를 API로 발행하고 taxInvoiceId 반환
async function createTaxInvoice(page: Page): Promise<string> {
  const invoiceId = await createIssuedInvoice(page);
  const res = await page.request.post(`${API}/tax-invoices`, {
    data: { invoiceId, issueDate: new Date().toISOString().slice(0, 10) },
  });
  expect(res.ok()).toBeTruthy();
  const { id } = (await res.json()) as { id: string };
  return id;
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('세금계산서 목록 - 헤더/필터/컬럼이 보인다', async ({ page }) => {
  await login(page);
  await page.goto('/tax-invoices');
  await expect(page.getByRole('heading', { name: '세금계산서' })).toBeVisible();
  await expect(page.getByRole('button', { name: '세금계산서', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '계산서번호' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '합계' })).toBeVisible();
});

test('세금계산서 발행 - 청구서 상세에서 발행하면 세금계산서 상세로 이동', async ({ page }) => {
  await login(page);
  const invoiceId = await createIssuedInvoice(page);
  await page.goto(`/invoices/${invoiceId}`);
  await expect(page.getByRole('heading', { name: '청구서 상세' })).toBeVisible();
  await page.getByRole('button', { name: '세금계산서 발행' }).click();
  await page.waitForURL(/\/tax-invoices\/[0-9a-f-]{8,}/);
  await expect(page.getByRole('heading', { name: '세금계산서 상세' })).toBeVisible();
});

test('세금계산서 취소 - ISSUED를 취소하면 취소 버튼이 사라진다', async ({ page }) => {
  await login(page);
  const id = await createTaxInvoice(page);
  await page.goto(`/tax-invoices/${id}`);
  const cancelBtn = page.getByRole('button', { name: '취소' });
  await expect(cancelBtn).toBeVisible();
  await cancelBtn.click();
  await expect(page.getByText('세금계산서를 취소했습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '취소' })).toHaveCount(0);
});

test('세금계산서 수정발행 - 수정세금계산서를 발행하면 새 상세로 이동', async ({ page }) => {
  await login(page);
  const id = await createTaxInvoice(page);
  await page.goto(`/tax-invoices/${id}`);
  await page.getByRole('button', { name: '수정세금계산서 발행' }).click();
  await expect(page.getByText('수정세금계산서를 발행했습니다.')).toBeVisible();
  await expect(page.getByRole('heading', { name: '세금계산서 상세' })).toBeVisible();
});
