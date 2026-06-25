import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/assets/')({
  component: AssetsPage,
});

function AssetsPage() {
  return <div className="p-6"><h1 className="text-xl font-semibold">자산</h1></div>;
}
