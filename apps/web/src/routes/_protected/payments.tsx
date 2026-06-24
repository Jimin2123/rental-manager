import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/payments')({
  component: PaymentsPage,
});

function PaymentsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">수납</h1>
    </div>
  );
}
