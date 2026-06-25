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

  // 재실행 시 BRN 중복(409) 방지를 위해 실행마다 고유 BRN 사용
  const uniqueSuffix = String(Date.now()).slice(-5);
  const companyName = `플레이라이트테스트거래처${uniqueSuffix}`;

  await page.goto('/business-partners/new');
  await page.getByLabel('매출 거래처').check();
  await page.getByPlaceholder('(주)거래처명').fill(companyName);
  await page.getByPlaceholder('123-45-67890').fill(`99900${uniqueSuffix}`);
  await page.getByRole('button', { name: '조회' }).click();
  await expect(page.getByText('✓ 계속사업자')).toBeVisible();
  await page.getByPlaceholder('홍길동').fill('홍대표');
  await page.getByRole('button', { name: '주소 검색' }).click();
  await page.getByRole('button', { name: '등록' }).click();
  // /business-partners/new 와 구분하기 위해 UUID 패턴(8자 이상 hex)으로 매칭
  await page.waitForURL(/\/business-partners\/[0-9a-f-]{8,}/);
  await expect(page.getByText(companyName).first()).toBeVisible({ timeout: 10000 });
});

test('거래처 상세 페이지 - 거래처 정보가 표시된다', async ({ page }) => {
  await login(page);
  // 목록에서 첫 번째 행을 클릭해 상세 페이지 접근
  await page.goto('/business-partners');
  // cursor-pointer 클래스는 실제 데이터 행에만 적용됨 (로딩/빈 상태 행 제외)
  const firstRow = page.locator('tr.cursor-pointer').first();
  await firstRow.waitFor({ state: 'visible', timeout: 15000 });
  const name = await firstRow.getByRole('cell').nth(0).textContent();
  await firstRow.click();
  await page.waitForURL(/\/business-partners\/[0-9a-f-]{8,}/);
  if (name) {
    await expect(page.getByText(name).first()).toBeVisible();
  }
  await expect(page.getByRole('button', { name: '수정' })).toBeVisible();
});

test('거래처 상세 - 수정 버튼 클릭 시 편집 모드로 전환된다', async ({ page }) => {
  await login(page);
  await page.goto('/business-partners');
  const firstRow = page.locator('tr.cursor-pointer').first();
  await firstRow.waitFor({ state: 'visible', timeout: 15000 });
  await firstRow.click();
  await page.waitForURL(/\/business-partners\/[0-9a-f-]{8,}/);
  await page.getByRole('button', { name: '수정' }).click();
  await expect(page.getByRole('button', { name: '저장' })).toBeVisible();
  await expect(page.getByRole('button', { name: '취소' })).toBeVisible();
});
