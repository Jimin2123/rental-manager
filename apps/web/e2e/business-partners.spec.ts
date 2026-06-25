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

test('거래처 등록 페이지 - 폼 필드가 표시된다', async ({ page }) => {
  await login(page);
  await mockKakaoPostcode(page);
  await page.goto('/business-partners/new');
  await expect(page.getByRole('heading', { name: '거래처 등록' })).toBeVisible();
  await expect(page.getByPlaceholder('(주)거래처명')).toBeVisible();
  await expect(page.getByPlaceholder('123-45-67890')).toBeVisible();
  await expect(page.getByLabel('매출 거래처')).toBeVisible();
  await expect(page.getByLabel('매입 거래처')).toBeVisible();
});

test('거래처 등록 - 사업자번호 조회 전 저장 시 에러가 표시된다', async ({ page }) => {
  await login(page);
  await mockKakaoPostcode(page);
  await page.route('**/organizations/brn/verify', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ valid: true, status: '계속사업자' }) }),
  );
  await page.goto('/business-partners/new');
  await page.getByLabel('매출 거래처').check();
  await page.getByPlaceholder('(주)거래처명').fill('테스트거래처');
  await page.getByPlaceholder('123-45-67890').fill('1234567890');
  await page.getByPlaceholder('홍길동').fill('홍대표');
  await page.getByRole('button', { name: '주소 검색' }).click();
  await page.getByRole('button', { name: '등록' }).click();
  await expect(page.getByText('사업자등록번호 조회를 먼저 완료해주세요.')).toBeVisible();
});

test('거래처 등록 전체 플로우 - 성공 시 상세 페이지로 이동한다', async ({ page }) => {
  await login(page);
  await mockKakaoPostcode(page);
  await page.route('**/organizations/brn/verify', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ valid: true, status: '계속사업자' }) }),
  );

  await page.goto('/business-partners/new');
  await page.getByLabel('매출 거래처').check();
  await page.getByPlaceholder('(주)거래처명').fill('플레이라이트테스트거래처');
  await page.getByPlaceholder('123-45-67890').fill('1234567890');
  await page.getByRole('button', { name: '조회' }).click();
  await expect(page.getByText('✓ 계속사업자')).toBeVisible();
  await page.getByPlaceholder('홍길동').fill('홍대표');
  await page.getByRole('button', { name: '주소 검색' }).click();
  await page.getByRole('button', { name: '등록' }).click();
  await page.waitForURL(/\/business-partners\/.+/);
  await expect(page.getByText('플레이라이트테스트거래처')).toBeVisible();
});
