import { test, expect } from '@playwright/test';

const MOCK_ORGS = [{ id: 'org1', name: '테스트', businessRegistrationNo: '1234567890', role: 'OWNER' }];

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test('/login 페이지에 소셜 로그인 버튼 3개가 노출된다', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Google로 로그인' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kakao로 로그인' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Naver로 로그인' })).toBeVisible();
});

test('소셜 로그인 실패 시 ?error=social 쿼리로 toast가 표시된다', async ({ page }) => {
  await page.goto('/login?error=social');
  await expect(page.getByText('소셜 로그인에 실패했습니다. 다시 시도해주세요.')).toBeVisible();
});

test('/setup 미인증 상태 접근 시 /login으로 리다이렉트된다', async ({ page }) => {
  await page.route('**/organizations/me', (route) => route.fulfill({ status: 401 }));
  await page.goto('/setup');
  await expect(page).toHaveURL('/login');
});

test('/setup 조직 있는 유저 접근 시 /로 리다이렉트된다', async ({ page }) => {
  // 복귀 사용자: 세션 마커가 있어야 부트스트랩이 /organizations/me를 호출한다
  await page.addInitScript(() => localStorage.setItem('rm_has_session', '1'));
  await page.route('**/organizations/me', (route) => route.fulfill({ status: 200, body: JSON.stringify(MOCK_ORGS) }));
  await page.route('**/auth/switch-org', (route) => route.fulfill({ status: 200, body: '{}' }));
  await page.goto('/setup');
  await expect(page).toHaveURL('/');
});

test('/setup 페이지가 정상 렌더링된다 (인증됨, 조직 없음)', async ({ page }) => {
  // 모든 라우트/initScript는 goto 전에 등록해야 적용된다(특히 카카오 주소 mock).
  // 복귀 사용자: 세션 마커가 있어야 부트스트랩이 /organizations/me를 호출한다
  await page.addInitScript(() => localStorage.setItem('rm_has_session', '1'));
  // setup 페이지는 받은 초대를 조회한다(무조직+초대 보유 안내) — 미모킹 시 실 API 호출
  await page.route('**/invitations/mine', (route) => route.fulfill({ status: 200, body: '[]' }));
  let setupVisited = false;
  await page.route('**/organizations/me', async (route) => {
    if (setupVisited) {
      await route.fulfill({ status: 200, body: JSON.stringify(MOCK_ORGS) });
    } else {
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
    }
  });
  await page.route('**/organizations/brn/verify', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ valid: true, status: '계속사업자' }) }),
  );
  await page.route('**/organizations', async (route) => {
    if (route.request().method() === 'POST') {
      setupVisited = true;
      await route.fulfill({ status: 201, body: JSON.stringify({ id: 'org1' }) });
    } else {
      await route.continue();
    }
  });
  await page.route('**/postcode.v2.js', (route) => route.fulfill({ body: '' }));
  await page.addInitScript(
    (addr) => {
      (window as unknown as Record<string, unknown>)['daum'] = {
        Postcode: function (opts: { oncomplete: (result: unknown) => void }) {
          return { open: () => opts.oncomplete(addr) };
        },
      };
    },
    {
      zonecode: '06234',
      address: '서울시 강남구 테헤란로 1',
      addressType: 'R',
      jibunAddress: '',
      roadAddress: '서울시 강남구 테헤란로 1',
      buildingName: '',
    },
  );

  await page.goto('/setup');
  await expect(page.getByRole('heading', { name: '조직 정보 입력' })).toBeVisible();
  await expect(page.getByRole('button', { name: '시작하기' })).toBeVisible();

  await page.getByPlaceholder('홍길동').first().fill('홍길동');
  await page.getByPlaceholder('(주)렌탈회사').fill('테스트회사');
  await page.getByPlaceholder('123-45-67890').fill('1234567890');
  await page.getByPlaceholder('홍길동').nth(1).fill('홍대표');
  await page.getByRole('button', { name: '주소 검색' }).click();
  await page.getByRole('button', { name: '조회' }).click();
  await expect(page.getByText('✓ 계속사업자')).toBeVisible();
  await page.getByRole('button', { name: '시작하기' }).click();
  await page.waitForURL('/');
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible();
});
