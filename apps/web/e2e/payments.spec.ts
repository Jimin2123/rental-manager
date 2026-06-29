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
  expect(res.ok()).toBeTruthy();
  const customers = (await res.json()) as Array<{ id: string }>;
  expect(customers.length).toBeGreaterThan(0);
  return customers[0].id;
}

async function createPayment(page: Page): Promise<string> {
  const customerId = await firstCustomerId(page);
  const res = await page.request.post(`${API}/payments`, {
    data: { customerId, method: 'CASH', amount: 1000, paidAt: new Date().toISOString() },
  });
  expect(res.ok()).toBeTruthy();
  const { id } = (await res.json()) as { id: string };
  return id;
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('수납 목록 - 헤더/필터/컬럼이 보인다', async ({ page }) => {
  await login(page);
  await page.goto('/payments');
  await expect(page.getByRole('heading', { name: '수납' })).toBeVisible();
  await expect(page.getByRole('button', { name: '수납 등록' })).toBeVisible();
  await expect(page.getByRole('button', { name: '현금' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '수납번호' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '금액' })).toBeVisible();
});

test('수납 생성 - 폼으로 등록하면 상세로 이동한다', async ({ page }) => {
  await login(page);
  await page.goto('/payments/new');
  await expect(page.getByRole('heading', { name: '수납 등록' })).toBeVisible();
  await page.locator('select').first().selectOption({ index: 1 });
  await page.locator('input[type="number"]').fill('5000');
  await page.locator('input[type="date"]').fill('2026-06-29');
  await page.getByRole('button', { name: '등록' }).click();
  await page.waitForURL(/\/payments\/[0-9a-f-]{8,}/);
  await expect(page.getByRole('heading', { name: '수납 상세' })).toBeVisible();
});

test('수납 취소 - 취소하면 액션 버튼이 사라진다', async ({ page }) => {
  await login(page);
  const id = await createPayment(page);
  await page.goto(`/payments/${id}`);
  const cancelBtn = page.getByRole('button', { name: '취소' });
  await expect(cancelBtn).toBeVisible();
  await cancelBtn.click();
  await expect(page.getByText('수납을 취소했습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '취소' })).toHaveCount(0);
});

// 회귀: 미수 청구서에 배분된 수납을 취소 — invoice 정산필드는 DB가 재계산하므로
// 앱이 수동 update하면 가드 트리거와 충돌해 500이 났었다(#114). 배분이 있어야 재현된다.
test('수납 취소 - 청구서에 배분된 수납도 취소된다 (#114)', async ({ page }) => {
  await login(page);
  const customerId = await firstCustomerId(page);

  // 항목 있는 ISSUED 청구서 생성 → 미수 발생
  const invRes = await page.request.post(`${API}/invoices`, { data: { type: 'MANUAL', customerId } });
  expect(invRes.ok()).toBeTruthy();
  const invoiceId = (await invRes.json()).id as string;
  const itemRes = await page.request.post(`${API}/invoices/${invoiceId}/items`, {
    data: { type: 'ETC', quantity: 1, unitPrice: 50000, description: '회귀 테스트 항목' },
  });
  expect(itemRes.ok()).toBeTruthy();
  expect((await page.request.post(`${API}/invoices/${invoiceId}/issue`, { data: {} })).ok()).toBeTruthy();

  // 같은 고객으로 수납 → FIFO로 위 청구서에 배분됨
  const payRes = await page.request.post(`${API}/payments`, {
    data: { customerId, method: 'CASH', amount: 50000, paidAt: new Date().toISOString() },
  });
  expect(payRes.ok()).toBeTruthy();
  const paymentId = (await payRes.json()).id as string;

  await page.goto(`/payments/${paymentId}`);
  // 배분 내역이 보이는지 확인(= 배분된 수납임)
  await expect(page.getByText(/배분/).first()).toBeVisible();
  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.getByText('수납을 취소했습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '취소' })).toHaveCount(0);
});
