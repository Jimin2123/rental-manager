import { test, expect } from '@playwright/test';

const MOCK_ADDRESS = {
  zonecode: '06234',
  address: '서울시 강남구 테헤란로 1',
  addressType: 'R' as const,
  jibunAddress: '서울시 강남구 역삼동 1',
  roadAddress: '서울시 강남구 테헤란로 1',
  buildingName: '테스트빌딩',
};

// 카카오 CDN 스크립트를 차단하고 window.daum 목(mock)으로 대체
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

// 미인증 상태로 시작 후 로그인 성공 시 org 데이터를 반환하는 route 설정
async function mockLoginFlow(page: import('@playwright/test').Page) {
  let loggedIn = false;
  await page.route('**/organizations/me', async (route) => {
    if (loggedIn) {
      await route.fulfill({
        status: 200,
        body: JSON.stringify([{ id: 'org1', businessProfile: { name: '테스트' } }]),
      });
    } else {
      await route.fulfill({ status: 401 });
    }
  });
  await page.route('**/auth/login', async (route) => {
    loggedIn = true;
    await route.fulfill({ status: 200, body: JSON.stringify({ message: 'ok' }) });
  });
}

async function agreeTerms(page: import('@playwright/test').Page) {
  await page.goto('/terms');
  await page.getByLabel('전체 동의').click();
  await page.getByRole('button', { name: '동의하고 가입하기' }).click();
  await page.waitForURL('/register');
}

async function fillRegisterForm(page: import('@playwright/test').Page) {
  await page.getByPlaceholder('admin@example.com').fill('newuser@test.com');
  await page.locator('input[type="password"]').nth(0).fill('Test1234!');
  await page.locator('input[type="password"]').nth(1).fill('Test1234!');
  await page.getByPlaceholder('홍길동').first().fill('홍길동');
  await page.getByPlaceholder('(주)렌탈회사').fill('테스트회사');
  await page.getByPlaceholder('123-45-67890').fill('1234567890');
  await page.getByPlaceholder('홍길동').nth(1).fill('홍대표');
  // 주소 검색 (카카오 mock이 즉시 콜백 호출)
  await page.getByRole('button', { name: '주소 검색' }).click();
}

// ────────────────────────────────────────────
// 1. 라우트 접근 제어
// ────────────────────────────────────────────

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('/register 직접 접근 시 약관 동의 페이지로 리다이렉트된다', async ({ page }) => {
  await page.goto('/register');
  await expect(page).toHaveURL('/terms');
});

test('이미 로그인된 상태에서 /terms 접근 시 대시보드로 리다이렉트된다', async ({ page }) => {
  await mockLoginFlow(page);

  await page.goto('/login');
  await page.locator('input[type="email"]').fill('test@test.com');
  await page.locator('input[type="password"]').fill('Test1234!');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL('/');

  await page.goto('/terms');
  await expect(page).toHaveURL('/');
});

test('이미 로그인된 상태에서 /register 접근 시 대시보드로 리다이렉트된다', async ({ page }) => {
  await mockLoginFlow(page);

  await page.goto('/login');
  await page.locator('input[type="email"]').fill('test@test.com');
  await page.locator('input[type="password"]').fill('Test1234!');
  await page.getByRole('button', { name: '로그인' }).click();
  await page.waitForURL('/');

  await page.goto('/register');
  await expect(page).toHaveURL('/');
});

// ────────────────────────────────────────────
// 2. 약관 동의 페이지
// ────────────────────────────────────────────

test('약관 동의 페이지가 정상 렌더링된다', async ({ page }) => {
  await page.goto('/terms');
  await expect(page.getByRole('heading', { name: '서비스 이용약관 동의' })).toBeVisible();
  await expect(page.getByLabel('전체 동의')).toBeVisible();
  await expect(page.locator('#agree-terms')).toBeVisible();
  await expect(page.locator('#agree-privacy')).toBeVisible();
  await expect(page.getByRole('button', { name: '동의하고 가입하기' })).toBeDisabled();
});

test('전체 동의 체크 시 모든 약관이 선택된다', async ({ page }) => {
  await page.goto('/terms');
  await page.getByLabel('전체 동의').click();
  await expect(page.locator('#agree-terms')).toBeChecked();
  await expect(page.locator('#agree-privacy')).toBeChecked();
  await expect(page.getByRole('button', { name: '동의하고 가입하기' })).toBeEnabled();
});

test('약관을 개별 동의해도 버튼이 활성화된다', async ({ page }) => {
  await page.goto('/terms');
  await page.locator('#agree-terms').click();
  await expect(page.getByRole('button', { name: '동의하고 가입하기' })).toBeDisabled();
  await page.locator('#agree-privacy').click();
  await expect(page.getByRole('button', { name: '동의하고 가입하기' })).toBeEnabled();
});

test('약관 동의 후 회원가입 페이지로 이동한다', async ({ page }) => {
  await agreeTerms(page);
  await expect(page).toHaveURL('/register');
  await expect(page.getByRole('heading', { name: '회원가입' })).toBeVisible();
});

// ────────────────────────────────────────────
// 3. 회원가입 폼 유효성
// ────────────────────────────────────────────

test('비밀번호 불일치 시 에러 메시지가 표시된다', async ({ page }) => {
  await agreeTerms(page);
  await page.getByPlaceholder('admin@example.com').fill('newuser@test.com');
  await page.locator('input[type="password"]').nth(0).fill('Test1234!');
  await page.locator('input[type="password"]').nth(1).fill('Different1!');
  await page.getByRole('button', { name: '가입하기' }).click();
  await expect(page.getByText('비밀번호가 일치하지 않습니다.')).toBeVisible();
});

test('사업자등록번호 입력 시 자동으로 포맷된다', async ({ page }) => {
  await agreeTerms(page);
  const brnInput = page.getByPlaceholder('123-45-67890');
  await brnInput.fill('1234567890');
  await expect(brnInput).toHaveValue('123-45-67890');
});

test('사업자등록번호 조회 전 가입하기 클릭 시 에러 메시지가 표시된다', async ({ page }) => {
  await mockKakaoPostcode(page);
  await page.route('**/organizations/brn/verify', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ valid: true, status: '계속사업자' }) }),
  );

  await agreeTerms(page);
  await fillRegisterForm(page);
  // BRN 조회 없이 바로 제출
  await page.getByRole('button', { name: '가입하기' }).click();
  await expect(page.getByText('사업자등록번호 조회를 먼저 완료해주세요.')).toBeVisible();
});

// ────────────────────────────────────────────
// 4. 사업자등록번호 조회
// ────────────────────────────────────────────

test('유효한 사업자등록번호 조회 시 계속사업자로 표시된다', async ({ page }) => {
  await agreeTerms(page);
  await page.route('**/organizations/brn/verify', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ valid: true, status: '계속사업자' }) }),
  );

  await page.getByPlaceholder('123-45-67890').fill('1234567890');
  await page.getByRole('button', { name: '조회' }).click();
  await expect(page.getByText('✓ 계속사업자')).toBeVisible();
});

test('유효하지 않은 사업자등록번호 조회 시 에러가 표시된다', async ({ page }) => {
  await agreeTerms(page);
  await page.route('**/organizations/brn/verify', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ valid: false, status: '폐업자' }) }),
  );

  await page.getByPlaceholder('123-45-67890').fill('1234567890');
  await page.getByRole('button', { name: '조회' }).click();
  await expect(page.getByText('✗ 폐업자')).toBeVisible();
});

test('10자리 미입력 시 조회 버튼이 비활성화된다', async ({ page }) => {
  await agreeTerms(page);
  await page.getByPlaceholder('123-45-67890').fill('12345');
  await expect(page.getByRole('button', { name: '조회' })).toBeDisabled();
});

// ────────────────────────────────────────────
// 5. 전체 회원가입 플로우
// ────────────────────────────────────────────

test('전체 회원가입 플로우가 완료되면 대시보드로 이동한다', async ({ page }) => {
  await mockKakaoPostcode(page);
  await page.route('**/organizations/brn/verify', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ valid: true, status: '계속사업자' }) }),
  );
  // signup 전엔 401, 가입 완료 후엔 org 데이터 반환
  let signedUp = false;
  await page.route('**/organizations/me', async (route) => {
    if (signedUp) {
      await route.fulfill({
        status: 200,
        body: JSON.stringify([{ id: 'org1', businessProfile: { name: '테스트회사' } }]),
      });
    } else {
      await route.fulfill({ status: 401 });
    }
  });
  await page.route('**/auth/signup', async (route) => {
    signedUp = true;
    await route.fulfill({ status: 200, body: JSON.stringify({ message: '가입이 완료되었습니다.' }) });
  });

  await agreeTerms(page);
  await fillRegisterForm(page);

  await page.getByRole('button', { name: '조회' }).click();
  await expect(page.getByText('✓ 계속사업자')).toBeVisible();

  await page.getByRole('button', { name: '가입하기' }).click();
  await page.waitForURL('/');
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible();
});

test('이미 사용 중인 이메일로 가입 시 에러 메시지가 표시된다', async ({ page }) => {
  await mockKakaoPostcode(page);
  await page.route('**/organizations/brn/verify', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ valid: true, status: '계속사업자' }) }),
  );
  await page.route('**/auth/signup', (route) =>
    route.fulfill({ status: 409, body: JSON.stringify({ message: '이미 사용 중인 이메일입니다.' }) }),
  );

  await agreeTerms(page);
  await fillRegisterForm(page);

  await page.getByRole('button', { name: '조회' }).click();
  await expect(page.getByText('✓ 계속사업자')).toBeVisible();

  await page.getByRole('button', { name: '가입하기' }).click();
  // form 필드 에러 메시지와 toast 두 곳에 뜨므로 첫 번째(form 메시지) 기준으로 검증
  await expect(page.getByText('이미 사용 중인 이메일입니다.').first()).toBeVisible();
});
