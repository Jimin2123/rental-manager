import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/invoices')({
  component: InvoicesPage,
});

function InvoicesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">청구서</h1>
    </div>
  );
}
