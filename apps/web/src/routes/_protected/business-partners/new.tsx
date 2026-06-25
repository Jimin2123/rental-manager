import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/business-partners/new')({
  component: NewBusinessPartnerPage,
});

function NewBusinessPartnerPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold">거래처 등록</h1>
    </div>
  );
}
