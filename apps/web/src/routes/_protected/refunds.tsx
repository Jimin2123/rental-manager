import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/refunds')({
  component: RefundsPage,
});

function RefundsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">환불</h1>
    </div>
  );
}
