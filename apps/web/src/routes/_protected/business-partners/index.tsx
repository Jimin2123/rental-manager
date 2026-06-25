import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/business-partners/')({
  component: BusinessPartnersPage,
});

function BusinessPartnersPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold">거래처</h1>
    </div>
  );
}
