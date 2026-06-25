import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/business-partners/$id')({
  component: BusinessPartnerDetailPage,
});

function BusinessPartnerDetailPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold">거래처 상세</h1>
    </div>
  );
}
