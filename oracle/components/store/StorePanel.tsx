'use client';

import { ChevronDown } from 'lucide-react';
import NavBar from './NavBar';
import Hero from './Hero';
import FeatureRow from './FeatureRow';
import ProductGrid from './ProductGrid';
import AdminControls from './AdminControls';
import { useStoreStream } from '@/lib/useStoreStream';

export default function StorePanel() {
  const { products, template, botDetection, watchedProductId, watchStatus } = useStoreStream();

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto bg-white">
      <NavBar />
      <div className="px-8 pb-6 pt-1">
        <div className="flex items-baseline justify-between">
          <h1 className="text-[34px] font-semibold tracking-tight">Store</h1>
          <button className="flex items-center gap-1 text-[13px] text-[var(--gray-1)]">
            Browse all <ChevronDown size={13} />
          </button>
        </div>
        <Hero />
        <FeatureRow />
        <ProductGrid
          products={products}
          template={template}
          watchedProductId={watchedProductId}
          watchStatus={watchStatus}
        />
      </div>
      <AdminControls state={{ products, template, botDetection }} />
    </div>
  );
}
