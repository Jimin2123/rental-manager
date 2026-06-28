import { test, expect } from '@playwright/test';

const EMAIL = 'test@test.com';
const PASSWORD = 'Test1234!';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: '로그인', exact: true }).click();
  await page.waitForURL('/');
}

const MOCK_ADDRESS = {
  zonecode: '06234',
  address: '서울시 강남구 테헤란로 1',
  addressType: 'R' as const,
  jibunAddress: '서울시 강남구 역삼동 1',
  roadAddress: '서울시 강남구 테헤란로 1',
  buildingName: '테스트빌딩',
};

async function mockKakaoPostcode(page: import('@playwright/test').Page) {
  await page.route('**/postcode.v2.js', (route) => route.fulfill({ body: '' }));
  await page.addInitScript((addr) => {
    (window as unknown as Record<string, unknown>)['daum'] = {
      Postcode: function (options: { oncomplete: (result: unknown) => void }) {
        return { open: () => options.oncomplete(addr) };
      },
    };
  }, MOCK_ADDRESS);
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('고객 목록 - 헤더/등록버튼/검색/상태필터/컬럼이 보인다', async ({ page }) => {
  await login(page);
  await page.goto('/customers');
  await expect(page.getByRole('heading', { name: '고객' })).toBeVisible();
  await expect(page.getByRole('button', { name: '고객 등록' })).toBeVisible();
  await expect(page.getByPlaceholder('이름·전화 검색')).toBeVisible();
  await expect(page.getByRole('button', { name: '전체' })).toBeVisible();
  await expect(page.getByRole('button', { name: '활성', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '거래정지' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '이름' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '유형' })).toBeVisible();
});

test('고객 등록 검증 - 이름 없이 등록 시 에러', async ({ page }) => {
  await login(page);
  await mockKakaoPostcode(page);
  await page.goto('/customers/new');
  await expect(page.getByRole('heading', { name: '고객 등록' })).toBeVisible();
  await page.getByRole('button', { name: '등록' }).click();
  await expect(page.getByText('이름을 입력해주세요.')).toBeVisible();
});

test('고객 전체 플로우 - 등록→상세→배정 섹션→수정모드', async ({ page }) => {
  await login(page);
  await mockKakaoPostcode(page);

  const suffix = String(Date.now()).slice(-6);
  const name = `플레이고객${suffix}`;

  // 등록
  await page.goto('/customers/new');
  await page.getByPlaceholder('홍길동').fill(name);
  await page.getByPlaceholder('010-1234-5678').fill('010-5555-1234');
  await page.getByPlaceholder('hong@example.com').fill('play@example.com');
  await page.getByRole('button', { name: '주소 검색' }).click();
  await expect(page.locator('input[readonly]').first()).toHaveValue('06234');
  await page.getByRole('button', { name: '등록' }).click();

  // 상세로 이동
  await page.waitForURL(/\/customers\/[0-9a-f-]{8,}/);
  await expect(page.getByRole('heading', { name }).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: '거래 정지' })).toBeVisible();
  await expect(page.getByRole('button', { name: '삭제' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '담당자 배정' })).toBeVisible();

  // 담당자 배정 추가
  await page.getByRole('button', { name: '+ 담당자 배정' }).click();
  const memberSelect = page.locator('select');
  await memberSelect.selectOption({ index: 1 });
  await page.getByPlaceholder('예: 계약 담당자').fill('계약 담당자');
  await page.getByRole('button', { name: '배정', exact: true }).click();
  await expect(page.getByRole('heading', { name: /담당자 배정 \(1명\)/ })).toBeVisible({ timeout: 10000 });

  // 수정 모드 전환
  await page.getByRole('button', { name: '수정' }).click();
  await expect(page.getByRole('button', { name: '저장' })).toBeVisible();

  // 목록에서 노출 확인
  await page.goto('/customers');
  await expect(page.getByText(name).first()).toBeVisible({ timeout: 10000 });
});

test('법인 고객 - 기존 거래처를 연결해 등록', async ({ page }) => {
  await login(page);
  await mockKakaoPostcode(page);
  await page.route('**/organizations/brn/verify', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ valid: true, status: '계속사업자' }) }),
  );

  const suffix = String(Date.now()).slice(-5);
  const company = `연결거래처${suffix}`;
  const brn = `88800${suffix}`;

  // 1) 거래처 먼저 등록
  await page.goto('/business-partners/new');
  await page.getByLabel('매출 거래처').check();
  await page.getByPlaceholder('(주)거래처명').fill(company);
  await page.getByPlaceholder('123-45-67890').fill(brn);
  await page.getByRole('button', { name: '조회' }).click();
  await expect(page.getByText('✓ 계속사업자')).toBeVisible();
  await page.getByPlaceholder('홍길동').fill('대표자');
  await page.getByRole('button', { name: '주소 검색' }).click();
  await page.getByRole('button', { name: '등록' }).click();
  await page.waitForURL(/\/business-partners\/[0-9a-f-]{8,}/);

  // 2) 법인 고객으로 연결 등록
  await page.goto('/customers/new');
  await page.getByRole('button', { name: '법인', exact: true }).click();
  await page.locator('select').selectOption({ label: `${company} (${brn})` });
  await page.getByRole('button', { name: '등록', exact: true }).click();

  // 3) 상세 — 법인 표시 + 거래처 링크
  await page.waitForURL(/\/customers\/[0-9a-f-]{8,}/);
  await expect(page.getByRole('heading', { name: company }).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('link', { name: '거래처에서 관리 →' })).toBeVisible();

  // 4) 같은 거래처 재연결 시 409 안내
  await page.goto('/customers/new');
  await page.getByRole('button', { name: '법인', exact: true }).click();
  await page.locator('select').selectOption({ label: `${company} (${brn})` });
  await page.getByRole('button', { name: '등록', exact: true }).click();
  await expect(page.getByText('이미 고객으로 등록된 거래처입니다.')).toBeVisible({ timeout: 10000 });
});
