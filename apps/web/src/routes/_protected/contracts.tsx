import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/contracts')({
  component: ContractsPage,
});

function ContractsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">계약</h1>
    </div>
  );
}
