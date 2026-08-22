import ProductCard from './ProductCard';
import type { StoreProduct } from '@/lib/useStoreStream';

interface Props {
  products: StoreProduct[];
  template: string;
  watchedProductId: string | null;
  watchStatus: string | null;
}

export default function ProductGrid({ products, template, watchedProductId, watchStatus }: Props) {
  return (
    <div>
      <div className="mt-7 flex items-baseline justify-between">
        <h2 className="text-[20px] font-semibold">Featured Products</h2>
        <a href="#" className="text-[13px] text-[var(--store-blue)]">
          See All
        </a>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-4 max-[1400px]:grid-cols-4">
        {products.map((p, i) => (
          <ProductCard
            key={p.id}
            product={p}
            template={template}
            watched={p.id === watchedProductId}
            watchStatus={watchStatus}
            className={i === 4 ? 'max-[1400px]:hidden' : ''}
          />
        ))}
      </div>
    </div>
  );
}
