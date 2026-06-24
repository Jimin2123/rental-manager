import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/customers')({
  component: CustomersPage,
});

function CustomersPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">고객</h1>
    </div>
  );
}
