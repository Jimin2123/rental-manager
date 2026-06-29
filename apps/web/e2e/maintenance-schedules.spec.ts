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

async function firstContractId(page: Page): Promise<string> {
  const res = await page.request.get(`${API}/rental-contracts`);
  expect(res.ok()).toBeTruthy();
  const contracts = (await res.json()) as Array<{ id: string }>;
  expect(contracts.length, '계약이 최소 1개 필요').toBeGreaterThan(0);
  return contracts[0].id;
}

// 점검 일정을 API로 생성하고 id 반환
async function createSchedule(page: Page): Promise<string> {
  const rentalContractId = await firstContractId(page);
  const res = await page.request.post(`${API}/maintenance-schedules`, {
    data: {
      rentalContractId,
      intervalUnit: 'MONTH',
      intervalValue: 3,
      nextScheduledAt: new Date().toISOString(),
    },
  });
  expect(res.ok()).toBeTruthy();
  const { id } = (await res.json()) as { id: string };
  return id;
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('점검 일정 목록 - 헤더/필터/컬럼이 보인다', async ({ page }) => {
  await login(page);
  await page.goto('/maintenance-schedules');
  await expect(page.getByRole('heading', { name: '정기점검' })).toBeVisible();
  await expect(page.getByRole('button', { name: '일정 등록' })).toBeVisible();
  await expect(page.getByRole('button', { name: '활성', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '다음 예정일' })).toBeVisible();
});

test('점검 일정 생성 - 폼으로 등록하면 상세로 이동', async ({ page }) => {
  await login(page);
  await page.goto('/maintenance-schedules/new');
  await expect(page.getByRole('heading', { name: '점검 일정 등록' })).toBeVisible();
  await page.locator('select').first().selectOption({ index: 1 });
  await page.locator('input[type="date"]').fill('2026-09-01');
  await page.getByRole('button', { name: '등록' }).click();
  await page.waitForURL(/\/maintenance-schedules\/[0-9a-f-]{8,}/);
  await expect(page.getByRole('heading', { name: '점검 일정 상세' })).toBeVisible();
});

test('점검 일정 수정 - 주기 값을 바꿔 저장하면 토스트가 뜬다', async ({ page }) => {
  await login(page);
  const id = await createSchedule(page);
  await page.goto(`/maintenance-schedules/${id}`);
  await page.getByRole('button', { name: '수정' }).click();
  await page.locator('input[type="number"]').fill('6');
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByText('점검 일정을 수정했습니다.')).toBeVisible();
});

test('점검 일정 비활성화 - 비활성화하면 버튼이 사라진다', async ({ page }) => {
  await login(page);
  const id = await createSchedule(page);
  await page.goto(`/maintenance-schedules/${id}`);
  const btn = page.getByRole('button', { name: '비활성화' });
  await expect(btn).toBeVisible();
  await btn.click();
  await expect(page.getByText('점검 일정을 비활성화했습니다.')).toBeVisible();
  await expect(page.getByRole('button', { name: '비활성화' })).toHaveCount(0);
});
