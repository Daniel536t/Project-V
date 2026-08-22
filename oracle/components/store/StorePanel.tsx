'use client';

import { ChevronDown } from 'lucide-react';
import NavBar from './NavBar';
import Hero from './Hero';
import FeatureRow from './FeatureRow';
import ProductGrid from './ProductGrid';
import AdminControls from './AdminControls';
import { useSharedStore } from '@/lib/StoreStreamContext';

export default function StorePanel() {
  const { products, template, watchedProductId, watchStatus } = useSharedStore();

  return (
    <div className="relative min-h-0 flex-1 bg-white">
      {/* scrollable store content (button stays pinned outside this) */}
      <div className="absolute inset-0 overflow-y-auto">
        <NavBar />
        <div className="px-8 pb-28 pt-1">
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
      </div>

      <AdminControls />
    </div>
  );
}
