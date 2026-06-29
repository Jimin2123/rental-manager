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

async function firstAssetId(page: Page): Promise<string> {
  const res = await page.request.get(`${API}/assets`);
  const assets = (await res.json()) as Array<{ id: string }>;
  expect(assets.length, '자산이 최소 1개 필요').toBeGreaterThan(0);
  return assets[0].id;
}

// 유상 AS 접수를 만들고 requestId 반환
async function createRequest(page: Page): Promise<string> {
  const [customerId, assetId] = [await firstCustomerId(page), await firstAssetId(page)];
  const res = await page.request.post(`${API}/service-requests`, {
    data: { type: 'REPAIR', customerId, assetId, isWarranty: false },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { id: string };
  return body.id;
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('AS 접수 목록 - 헤더/필터/컬럼이 보인다', async ({ page }) => {
  await login(page);
  await page.goto('/service-requests');
  await expect(page.getByRole('heading', { name: 'AS 접수' })).toBeVisible();
  await expect(page.getByRole('button', { name: '접수 등록' })).toBeVisible();
  await expect(page.getByRole('button', { name: '수리' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '접수번호' })).toBeVisible();
});

test('AS 접수 생성 - 폼으로 등록하면 상세로 이동', async ({ page }) => {
  await login(page);
  await page.goto('/service-requests/new');
  await expect(page.getByRole('heading', { name: 'AS 접수 등록' })).toBeVisible();
  // 고객 select(두 번째), 자산 select(세 번째). 첫 select는 유형.
  await page.locator('select').nth(1).selectOption({ index: 1 });
  await page.locator('select').nth(2).selectOption({ index: 1 });
  await page.getByRole('button', { name: '등록' }).click();
  await page.waitForURL(/\/service-requests\/[0-9a-f-]{8,}/);
  await expect(page.getByRole('heading', { name: 'AS 접수 상세' })).toBeVisible();
});

test('AS 방문 추가 - 방문을 추가하면 목록에 나타난다', async ({ page }) => {
  await login(page);
  const id = await createRequest(page);
  await page.goto(`/service-requests/${id}`);
  await expect(page.getByText('방문 내역이 없습니다.')).toBeVisible();
  await page.getByRole('button', { name: '추가' }).click();
  await expect(page.getByText('방문을 추가했습니다.')).toBeVisible();
  await expect(page.getByText('방문 내역이 없습니다.')).toHaveCount(0);
});

test('AS 방문 완료 - 비용 입력 후 완료하면 토스트가 뜬다', async ({ page }) => {
  await login(page);
  const id = await createRequest(page);
  await page.goto(`/service-requests/${id}`);
  await page.getByRole('button', { name: '추가' }).click();
  await expect(page.getByText('방문을 추가했습니다.')).toBeVisible();
  await page.getByRole('button', { name: '완료', exact: true }).first().click();
  await page.getByPlaceholder('공임비').fill('50000');
  await page.getByRole('button', { name: '완료 처리' }).click();
  await expect(page.getByText(/방문을 완료 처리했습니다/)).toBeVisible();
});

// 회귀: SCHEDULED 접수의 마지막 방문을 취소하면 접수를 RECEIVED로 되돌리는데,
// 전이맵에 SCHEDULED→RECEIVED가 없어 500이 났었다(#117).
test('AS 방문 취소 - 마지막 방문 취소 시 접수가 복귀된다 (#117)', async ({ page }) => {
  await login(page);
  const id = await createRequest(page);
  await page.goto(`/service-requests/${id}`);
  await page.getByRole('button', { name: '추가' }).click();
  await expect(page.getByText('방문을 추가했습니다.')).toBeVisible();
  // 방문 행의 취소 → 토스트(현재는 500이라 안 뜸)
  await page.getByRole('button', { name: '취소', exact: true }).first().click();
  await expect(page.getByText('방문을 취소했습니다.')).toBeVisible();
});
