import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/products/$id')({
  component: ProductDetailPage,
});

function ProductDetailPage() {
  return <div className="p-6"><h1 className="text-xl font-semibold">제품 상세</h1></div>;
}
