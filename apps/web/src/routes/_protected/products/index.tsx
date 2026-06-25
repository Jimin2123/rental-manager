import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/products/')({
  component: ProductsPage,
});

function ProductsPage() {
  return <div className="p-6"><h1 className="text-xl font-semibold">제품</h1></div>;
}
