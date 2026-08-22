'use client';

import { useEffect, useRef, useState } from 'react';
import { Bookmark } from 'lucide-react';
import ProductImage from './ProductImage';
import { useSenseUi } from '@/lib/SenseUiContext';
import { suggestedWatchTarget } from '@/lib/store-shared';
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
  const { setDraft, focusInput } = useSenseUi();

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
  // Only the active (watched) card carries the template's semantic selectors —
  // the scraper must extract exactly one price, from the watched product.
  const semantic = watched;

  // Clicking a card switches the store (and scraper target) to this product,
  // then prefills the SENSE chat with a ready-to-send watch request.
  function handleClick() {
    if (!watched) {
      fetch('/api/store/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'select_product', productId: product.id }),
      }).catch(() => {});
    }
    setDraft(
      `Alert me when the ${product.name} drops below $${suggestedWatchTarget(product.originalPrice)}`,
    );
    focusInput();
  }

  let ring = '';
  if (watched) {
    if (watchStatus === 'broken') ring = 'ring-2 ring-[var(--danger)]/50 animate-glitch';
    else if (watchStatus === 'healing') ring = 'ring-2 ring-[var(--amber)]/50';
    else if (watchStatus === 'healed') ring = 'ring-2 ring-[var(--success)]';
    else ring = 'ring-2 ring-[var(--ios-blue)]/50';
  }
  if (flash) ring = `ring-2 ring-[var(--success)] animate-heal-flash`;

  const rawPrice = `$${price}`;
  const stock = product.inStock ? 'In Stock' : 'Out of Stock';

  // ---- shared pieces -------------------------------------------------------

  const imageTile = (tileClass: string, imgClass = '') => (
    <div className={`relative shrink-0 overflow-hidden ${tileClass} ${ring}`}>
      <ProductImage
        src={product.image}
        alt={product.name}
        objectFit="cover"
        className={`h-full w-full ${imgClass}`}
      />
      {product.inStock === false && (
        <span className="absolute inset-0 grid place-items-center rounded-2xl bg-white/50">
          <span className="rounded-full border border-[var(--line)] bg-white/90 px-2.5 py-1 text-[12px] font-medium text-[var(--gray-1)]">
            Currently unavailable
          </span>
        </span>
      )}
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

  const caption = watched ? (
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
  ) : null;

  const nameEl = (extra = '') => {
    const base = `text-[13.5px] font-semibold leading-tight ${extra}`.trim();
    if (template === 'B') {
      return semantic ? (
        <h3 data-testid="product-name" className={base}>
          {product.name}
        </h3>
      ) : (
        <h3 className={base}>{product.name}</h3>
      );
    }
    if (template === 'C') {
      return semantic ? (
        <h3 itemProp="name" className={base}>
          {product.name}
        </h3>
      ) : (
        <h3 className={base}>{product.name}</h3>
      );
    }
    return semantic ? (
      <h3 className={`product-title ${base}`}>{product.name}</h3>
    ) : (
      <h3 className={base}>{product.name}</h3>
    );
  };

  const priceEl = (extra = '') => {
    if (template === 'B') {
      return semantic ? (
        <span data-test="current-price" className={`mono text-[18px] font-semibold ${extra}`}>
          {rawPrice}
        </span>
      ) : (
        <span className={`mono text-[18px] font-semibold ${extra}`}>{rawPrice}</span>
      );
    }
    if (template === 'C') {
      return semantic ? (
        <span className={`display-price mono text-[18px] font-semibold ${extra}`}>{rawPrice}</span>
      ) : (
        <span className={`mono text-[18px] font-semibold ${extra}`}>{rawPrice}</span>
      );
    }
    return semantic ? (
      <span className={`price text-[12.5px] text-[var(--gray-1)] ${extra}`}>{rawPrice}</span>
    ) : (
      <span className={`text-[12.5px] text-[var(--gray-1)] ${extra}`}>{rawPrice}</span>
    );
  };

  const stockEl = () => {
    if (!semantic) return null;
    if (template === 'A') return <span className="stock-status sr-only">{stock}</span>;
    return <span className="availability-badge sr-only">{stock}</span>;
  };

  // ---- Template B — "Modern" (horizontal, image left, big mono price) ------
  if (template === 'B') {
    const inner = (
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white p-3 shadow-sm">
        {imageTile('aspect-square w-1/2 rounded-xl bg-[var(--card)]')}
        <div className="min-w-0 flex-1">
          {nameEl()}
          {priceLine(priceEl())}
          {stockEl()}
          {caption}
          {swatches}
        </div>
      </div>
    );
    return (
      <div className={`${className ?? ''} cursor-pointer`} onClick={handleClick}>
        {semantic ? <div className="pricing-section">{inner}</div> : inner}
      </div>
    );
  }

  // ---- Template C — "Schema" (feature card, image right, tagline) ----------
  if (template === 'C') {
    const inner = (
      <div className="flex items-center gap-3 rounded-2xl bg-[var(--card)] p-3">
        <div className="min-w-0 flex-1">
          {nameEl()}
          <p className="mt-0.5 text-[11px] leading-snug text-[var(--gray-1)]">{product.tagline}</p>
          {priceLine(priceEl())}
          {stockEl()}
          {caption}
          {swatches}
        </div>
        {imageTile('aspect-square w-1/2 rounded-xl bg-white')}
        {semantic && (
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
        )}
      </div>
    );
    return (
      <div className={`${className ?? ''} cursor-pointer`} onClick={handleClick}>
        {inner}
      </div>
    );
  }

  // ---- Template A — "Classic" (vertical, image top) ------------------------
  const inner = (
    <>
      {imageTile(
        'aspect-square rounded-2xl bg-[var(--card)]',
        'transition-transform duration-300 group-hover:scale-[1.03]',
      )}
      {nameEl('mt-2.5')}
      {priceLine(priceEl())}
      {stockEl()}
      {caption}
      {swatches}
    </>
  );
  return (
    <div className={`${className ?? ''} group cursor-pointer`} onClick={handleClick}>
      {semantic ? <div className="product-container">{inner}</div> : inner}
    </div>
  );
}
