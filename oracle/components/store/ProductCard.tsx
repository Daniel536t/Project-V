'use client';

import { useEffect, useRef, useState } from 'react';
import { Bookmark } from 'lucide-react';
import ProductImage from './ProductImage';
import type { StoreProduct } from '@/lib/useStoreStream';

interface Props {
  product: StoreProduct;
  template: string;
  watched: boolean;
  watchStatus: string | null;
  className?: string;
}

const STATUS_LABEL: Record<string, string> = {
  watching: '● Watching',
  checking: '● Checking',
  broken: '⚠ Broken',
  healing: '⚙ Healing',
  healed: '✓ Healed',
  alerted: '🔔 Alerted',
};

export default function ProductCard({ product, template, watched, watchStatus, className }: Props) {
  const [flash, setFlash] = useState(false);
  const prev = useRef<string | null>(watchStatus);

  // One green pulse on broken → healed.
  useEffect(() => {
    if (prev.current === 'broken' && (watchStatus === 'healed' || watchStatus === 'watching')) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 620);
      prev.current = watchStatus;
      return () => clearTimeout(t);
    }
    prev.current = watchStatus;
  }, [watchStatus]);

  const price = product.livePrice ?? product.originalPrice;
  const changed = product.livePrice != null && product.livePrice !== product.originalPrice;

  let ring = '';
  if (watched) {
    if (watchStatus === 'broken') ring = 'ring-1 ring-[var(--danger)]/30 animate-glitch';
    else if (watchStatus === 'healing') ring = 'ring-1 ring-[var(--amber)]/40';
    else if (watchStatus === 'healed') ring = 'ring-1 ring-[var(--success)]';
    else ring = 'ring-1 ring-[var(--ios-blue)]/40';
  }
  if (flash) ring = `ring-1 ring-[var(--success)] animate-heal-flash`;

  const imageWrap = (
    <div
      className={`relative grid aspect-[1/1.08] place-items-center rounded-[14px] bg-[var(--card)] p-6 ${ring}`}
    >
      <ProductImage src={product.image} alt={product.name} className="max-h-full w-full" />
      <Bookmark size={15} className="absolute right-2.5 top-2.5 text-[var(--gray-1)]" />
    </div>
  );

  const swatches = (
    <div className="mt-1.5 flex gap-1.5">
      {product.colors.map((c) => (
        <span
          key={c}
          className="h-2.5 w-2.5 rounded-full border border-black/10"
          style={{ background: c }}
        />
      ))}
    </div>
  );

  // Non-watched card: plain markup, no semantic selectors (the scraper must
  // only ever hit the active product's price).
  if (!watched) {
    return (
      <div className={className}>
        {imageWrap}
        <h3 className="mt-2.5 text-[13.5px] font-semibold leading-tight">{product.name}</h3>
        <div className="mt-0.5 text-[12.5px] text-[var(--gray-1)]">${product.originalPrice}</div>
        {swatches}
      </div>
    );
  }

  const rawPrice = `$${price}`;
  const stock = product.inStock ? 'In Stock' : 'Out of Stock';

  const priceLine = (priceEl: React.ReactNode) => (
    <div className="mt-0.5 flex items-baseline gap-1.5">
      {changed && <span className="text-[11px] font-semibold text-[var(--success)]">Now</span>}
      {priceEl}
      {changed && (
        <span className="text-[12px] text-[var(--gray-2)] line-through">
          ${product.originalPrice}
        </span>
      )}
    </div>
  );

  const caption = (
    <span
      className={`mt-0.5 block text-[10px] ${
        watchStatus === 'broken' || watchStatus === 'alerted'
          ? 'text-[var(--danger)]'
          : watchStatus === 'healing'
            ? 'text-[var(--amber)]'
            : watchStatus === 'healed'
              ? 'text-[var(--success)]'
              : 'text-[var(--ios-blue)]'
      }`}
    >
      {STATUS_LABEL[watchStatus ?? 'watching'] ?? '● Watching'}
    </span>
  );

  // Template B — "Modern"
  if (template === 'B') {
    return (
      <div className={className}>
        <div className="pricing-section">
          {imageWrap}
          <h3 data-testid="product-name" className="mt-2.5 text-[13.5px] font-semibold leading-tight">
            {product.name}
          </h3>
          {priceLine(
            <span data-test="current-price" className="text-[12.5px] text-[var(--gray-1)]">
              {rawPrice}
            </span>,
          )}
          <span className="availability-badge sr-only">{stock}</span>
          {caption}
          {swatches}
        </div>
      </div>
    );
  }

  // Template C — "Schema"
  if (template === 'C') {
    return (
      <div className={className}>
        {imageWrap}
        <h3 itemProp="name" className="mt-2.5 text-[13.5px] font-semibold leading-tight">
          {product.name}
        </h3>
        {priceLine(
          <span className="display-price text-[12.5px] text-[var(--gray-1)]">{rawPrice}</span>,
        )}
        <span className="availability-badge sr-only">{stock}</span>
        {caption}
        {swatches}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Product',
              name: product.name,
              offers: {
                '@type': 'Offer',
                price: String(price),
                priceCurrency: 'USD',
                availability: product.inStock ? 'InStock' : 'OutOfStock',
              },
            }),
          }}
        />
      </div>
    );
  }

  // Template A — "Classic"
  return (
    <div className={className}>
      <div className="product-container">
        {imageWrap}
        <h3 className="product-title mt-2.5 text-[13.5px] font-semibold leading-tight">
          {product.name}
        </h3>
        {priceLine(
          <span className="price text-[12.5px] text-[var(--gray-1)]">{rawPrice}</span>,
        )}
        <span className="stock-status sr-only">{stock}</span>
        {caption}
        {swatches}
      </div>
    </div>
  );
}
