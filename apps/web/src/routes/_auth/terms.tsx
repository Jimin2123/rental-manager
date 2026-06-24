import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store/auth.store';

export const Route = createFileRoute('/_auth/terms')({
  beforeLoad: () => {
    const { currentOrganization } = useAuthStore.getState();
    if (currentOrganization) throw redirect({ to: '/' });
  },
  component: TermsPage,
});

const TERMS_OF_SERVICE = `제1조 (목적)
이 약관은 렌탈 매니저(이하 "서비스")의 이용 조건 및 절차, 이용자와 서비스 제공자의 권리·의무 등을 규정함을 목적으로 합니다.

제2조 (서비스 이용)
서비스는 렌탈 자산 관리, 계약 관리, 고객 관리 등의 기능을 제공합니다. 이용자는 본 약관에 동의함으로써 서비스를 이용할 수 있습니다.

제3조 (이용자의 의무)
이용자는 관계 법령, 본 약관의 규정, 서비스 이용안내 등을 준수하여야 하며, 서비스의 정상적인 운영을 방해하는 행위를 하여서는 안 됩니다.

제4조 (서비스 제공의 중단)
서비스 제공자는 시스템 정기점검, 설비의 교체 또는 고장, 통신 두절 등의 경우 서비스 제공을 일시적으로 중단할 수 있습니다.

제5조 (면책조항)
서비스 제공자는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 책임이 면제됩니다.`;

const PRIVACY_POLICY = `제1조 (수집하는 개인정보 항목)
회사는 서비스 제공을 위해 다음의 개인정보를 수집합니다.
- 필수 항목: 이메일, 비밀번호, 이름, 사업자등록번호, 상호명, 대표자명, 주소

제2조 (개인정보의 수집 및 이용 목적)
수집한 개인정보는 서비스 제공, 회원 관리, 계약 관리 등에 이용됩니다.

제3조 (개인정보의 보유 및 이용 기간)
이용자의 개인정보는 서비스 이용 계약이 존속하는 기간 동안 보유합니다. 회원 탈퇴 시 즉시 파기합니다.

제4조 (개인정보의 제3자 제공)
회사는 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다.

제5조 (개인정보 보호 책임자)
개인정보 보호에 관한 문의사항은 고객센터를 통해 문의하시기 바랍니다.`;

function TermsPage() {
  const navigate = useNavigate();
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);

  const allAgreed = agreedTerms && agreedPrivacy;

  const handleAgreeAll = (checked: boolean) => {
    setAgreedTerms(checked);
    setAgreedPrivacy(checked);
  };

  const handleNext = () => {
    sessionStorage.setItem('terms_agreed', 'true');
    void navigate({ to: '/register' });
  };

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="mb-2 text-lg font-semibold text-card-foreground">서비스 이용약관 동의</h2>
      <p className="mb-6 text-sm text-muted-foreground">서비스 이용을 위해 아래 약관에 동의해 주세요.</p>

      <div className="mb-4 flex items-center gap-2 rounded-md border bg-muted/40 p-3">
        <Checkbox id="agree-all" checked={allAgreed} onCheckedChange={(v) => handleAgreeAll(v === true)} />
        <label htmlFor="agree-all" className="cursor-pointer text-sm font-medium">
          전체 동의
        </label>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox id="agree-terms" checked={agreedTerms} onCheckedChange={(v) => setAgreedTerms(v === true)} />
            <label htmlFor="agree-terms" className="cursor-pointer text-sm font-medium">
              이용약관 동의 <span className="text-destructive">(필수)</span>
            </label>
          </div>
          <div className="h-32 overflow-y-auto rounded border bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {TERMS_OF_SERVICE}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="agree-privacy"
              checked={agreedPrivacy}
              onCheckedChange={(v) => setAgreedPrivacy(v === true)}
            />
            <label htmlFor="agree-privacy" className="cursor-pointer text-sm font-medium">
              개인정보처리방침 동의 <span className="text-destructive">(필수)</span>
            </label>
          </div>
          <div className="h-32 overflow-y-auto rounded border bg-muted/20 p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {PRIVACY_POLICY}
          </div>
        </div>
      </div>

      <Button className="mt-6 w-full" disabled={!allAgreed} onClick={handleNext}>
        동의하고 가입하기
      </Button>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        이미 계정이 있으신가요?{' '}
        <a href="/login" className="text-primary underline-offset-4 hover:underline">
          로그인
        </a>
      </p>
    </div>
  );
}
