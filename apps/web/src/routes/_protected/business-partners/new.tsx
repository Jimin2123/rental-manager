import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { PartnerForm } from './-components/PartnerForm';

export const Route = createFileRoute('/_protected/business-partners/new')({
  component: NewBusinessPartnerPage,
});

function NewBusinessPartnerPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/business-partners' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">거래처 등록</h1>
      </div>
      <PartnerForm />
    </div>
  );
}
