import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import type { Product } from './-types';
import { fetchProduct, productKeys } from './-api';
import { ProductInfoCard } from './-components/ProductInfoCard';
import { AssetTable } from './-components/AssetTable';

export const Route = createFileRoute('/_protected/products/$id')({
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: productKeys.detail(id),
    queryFn: () => fetchProduct(id),
  });

  if (isLoading) return <div className="p-6 text-muted-foreground">불러오는 중...</div>;
  if (!product) return <div className="p-6 text-muted-foreground">제품을 찾을 수 없습니다.</div>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="outline" size="sm" onClick={() => void navigate({ to: '/products' })}>
          ← 목록
        </Button>
        <h1 className="text-xl font-semibold text-foreground">{product.name}</h1>
      </div>

      <div className="space-y-4">
        <ProductInfoCard product={product} onDeleted={() => void navigate({ to: '/products' })} />
        <AssetTable productId={id} />
      </div>
    </div>
  );
}
