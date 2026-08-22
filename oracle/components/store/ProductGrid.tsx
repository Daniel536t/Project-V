import ProductCard from './ProductCard';
import type { StoreProduct } from '@/lib/useStoreStream';

interface Props {
  products: StoreProduct[];
  template: string;
  watchedProductId: string | null;
  watchStatus: string | null;
}

export default function ProductGrid({ products, template, watchedProductId, watchStatus }: Props) {
  // Each template reflows the grid: A = dense 5-up vertical, B = 3-up
  // horizontal, C = 2-up feature cards. The layout change is the "redesign".
  const cols =
    template === 'C'
      ? 'grid-cols-2'
      : template === 'B'
        ? 'grid-cols-3'
        : 'grid-cols-5 max-[1400px]:grid-cols-4';

  return (
    <div>
      <div className="mt-7 flex items-baseline justify-between">
        <h2 className="text-[20px] font-semibold">Featured Products</h2>
        <a href="#" className="text-[13px] text-[var(--store-blue)]">
          See All
        </a>
      </div>
      <div className={`mt-3 grid gap-4 ${cols}`}>
        {products.map((p, i) => (
          <ProductCard
            key={p.id}
            product={p}
            template={template}
            watched={p.id === watchedProductId}
            watchStatus={watchStatus}
            className={template === 'A' && i === 4 ? 'max-[1400px]:hidden' : ''}
          />
        ))}
      </div>
    </div>
  );
}
