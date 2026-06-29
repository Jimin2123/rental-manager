import { request } from '@playwright/test';

// E2E 공용 시드. 실백엔드 스펙들이 전제하는 기준 데이터를 API로 만든다(멱등).
// 실행 중인 API(:3000)에 request 컨텍스트로 호출하며, signup/login이 내려준 httpOnly
// 쿠키가 컨텍스트에 보존되어 이후 보호 엔드포인트 호출에 자동 첨부된다.

const API = 'http://localhost:3000';
const EMAIL = 'test@test.com';
const PASSWORD = 'Test1234!';

const SIGNUP = {
  email: EMAIL,
  password: PASSWORD,
  memberName: '테스트',
  name: '테스트회사',
  businessRegistrationNo: '1234567890',
  representativeName: '홍대표',
  zonecode: '06234',
  address: '서울시 강남구 테헤란로 1',
};

async function idOf(res: { json: () => Promise<unknown> }): Promise<string> {
  const body = (await res.json()) as { id?: string; orderId?: string };
  const id = body.id ?? body.orderId;
  if (!id) throw new Error(`응답에 id가 없습니다: ${JSON.stringify(body)}`);
  return id;
}

export default async function globalSetup(): Promise<void> {
  const ctx = await request.newContext({ baseURL: API });

  // 1. 인증: 신규면 signup, 이미 있으면 409 → login. 쿠키는 ctx에 보존.
  //    signup/login 응답 본문은 조직 배열. 보호 엔드포인트는 조직 컨텍스트를 요구하므로
  //    switch-org로 활성 조직을 설정해야 한다(웹 앱과 동일한 흐름).
  let orgs: Array<{ id: string }>;
  const signup = await ctx.post('/auth/signup', { data: SIGNUP });
  if (signup.status() === 409) {
    const login = await ctx.post('/auth/login', { data: { email: EMAIL, password: PASSWORD } });
    if (!login.ok()) throw new Error(`E2E 시드 로그인 실패: ${login.status()} ${await login.text()}`);
    orgs = (await login.json()) as Array<{ id: string }>;
  } else if (!signup.ok()) {
    throw new Error(`E2E 시드 가입 실패: ${signup.status()} ${await signup.text()}`);
  } else {
    orgs = (await signup.json()) as Array<{ id: string }>;
  }
  if (orgs.length === 0) throw new Error('E2E 시드 계정에 조직이 없습니다.');
  const switched = await ctx.post('/auth/switch-org', { data: { organizationId: orgs[0].id } });
  if (!switched.ok()) throw new Error(`E2E 시드 조직 전환 실패: ${switched.status()} ${await switched.text()}`);

  // 2. 멱등: 이미 고객 데이터가 있으면 시드 스킵(로컬 재실행 안전).
  const existing = await ctx.get('/customers');
  if (existing.ok() && ((await existing.json()) as unknown[]).length > 0) {
    await ctx.dispose();
    return;
  }

  const fail = async (label: string, res: { status: () => number; text: () => Promise<string> }): Promise<never> => {
    throw new Error(`${label} 시드 실패: ${res.status()} ${await res.text()}`);
  };

  // 3. 고객(개인)
  const customerRes = await ctx.post('/customers', {
    data: {
      type: 'INDIVIDUAL',
      individualProfile: { name: '홍길동', address: { zonecode: '06234', address: '서울시 강남구 테헤란로 1' } },
    },
  });
  if (!customerRes.ok()) await fail('고객', customerRes);
  const customerId = await idOf(customerRes);

  // 4. 제품
  const productRes = await ctx.post('/products', { data: { name: '테스트 복합기' } });
  if (!productRes.ok()) await fail('제품', productRes);
  const productId = await idOf(productRes);

  // 5. 자산(AVAILABLE)
  const assetRes = await ctx.post('/assets', { data: { productId, initialStatus: 'AVAILABLE' } });
  if (!assetRes.ok()) await fail('자산', assetRes);
  const assetId = await idOf(assetRes);

  // 6. 렌탈 주문(자산 지정)
  const orderRes = await ctx.post('/orders', {
    data: { type: 'RENTAL', customerId, rentalOrder: { items: [{ productId, assetId, monthlyRentalPrice: 50000 }] } },
  });
  if (!orderRes.ok()) await fail('주문', orderRes);
  const orderId = await idOf(orderRes);

  // 7. 계약 — 주문 상세에서 rentalOrder.id + 항목 id를 읽어 한 번에 생성.
  const detailRes = await ctx.get(`/orders/${orderId}`);
  if (!detailRes.ok()) await fail('주문 상세', detailRes);
  const detail = (await detailRes.json()) as {
    rentalOrder: { id: string; items: Array<{ id: string; assetId: string | null; monthlyRentalPrice: number }> };
  };
  const items = detail.rentalOrder.items
    .filter((it) => it.assetId)
    .map((it) => ({
      assetId: it.assetId as string,
      rentalOrderItemId: it.id,
      monthlyRentalPrice: it.monthlyRentalPrice,
    }));

  const now = new Date();
  const end = new Date(now);
  end.setFullYear(end.getFullYear() + 1);
  const contractRes = await ctx.post('/rental-contracts', {
    data: {
      rentalOrderId: detail.rentalOrder.id,
      startDate: now.toISOString(),
      endDate: end.toISOString(),
      contractMonths: 12,
      billingTiming: 'PREPAID',
      items,
    },
  });
  if (!contractRes.ok()) await fail('계약', contractRes);

  await ctx.dispose();
}
