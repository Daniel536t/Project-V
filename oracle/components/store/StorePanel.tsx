import { PRODUCTS } from '@/lib/products';
import ProductImage from './ProductImage';
import {
  Bookmark,
  Headphones,
  Lock,
  RefreshCcw,
  Search,
  ShoppingBag,
  Truck,
} from 'lucide-react';

const NAV = ['Store', 'Mac', 'iPad', 'iPhone', 'Watch', 'AirPods', 'Accessories', 'Support'];

const BENEFITS = [
  { title: 'Free shipping', sub: 'On all orders', icon: Truck },
  { title: '30-day returns', sub: 'Hassle-free', icon: RefreshCcw },
  { title: 'Secure payment', sub: '256-bit encrypted', icon: Lock },
  { title: 'Specialist support', sub: 'Always here', icon: Headphones },
];

export default function StorePanel() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {/* nav */}
      <nav className="flex h-[57px] shrink-0 items-center gap-8 border-b border-[var(--line)] px-5 text-[13px]">
        <span className="text-[17px] font-semibold text-[var(--ink)]"></span>
        {NAV.map((n) => (
          <a
            key={n}
            href="#"
            className={
              n === 'Store'
                ? 'font-medium text-[var(--ink)]'
                : 'text-[var(--gray-1)] transition hover:text-[var(--ink)]'
            }
          >
            {n}
          </a>
        ))}
        <span className="flex-1" />
        <Search size={19} className="text-[var(--ink)]" />
        <ShoppingBag size={19} className="text-[var(--ink)]" />
      </nav>

      {/* scrollable body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-4">
        {/* heading */}
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-[24px] font-semibold text-[var(--ink)]">Store</h2>
          <span className="text-[13px] text-[var(--store-blue)]">Browse all ⌄</span>
        </div>

        {/* hero */}
        <div className="relative mb-5 h-[304px] overflow-hidden rounded-[13px] bg-gradient-to-br from-[#fafafa] to-[#f2f2f4] px-8 pt-[52px]">
          <p className="text-[15px] font-medium text-[#b64400]">New season.</p>
          <h3 className="mt-1 text-[35px] font-semibold leading-[1.05] tracking-[-1px] text-[var(--ink)]">
            Elevated.
          </h3>
          <p className="mt-3 max-w-[300px] text-[15px] leading-relaxed text-[#333]">
            Explore the latest in tech, style, and everyday essentials.
          </p>
          <button className="mt-5 rounded-[8px] bg-[var(--store-blue)] px-4 py-2.5 text-[13px] font-medium text-white transition hover:bg-[var(--store-blue-hover)]">
            Shop Now
          </button>
          <div className="absolute right-8 top-6 flex h-[85%] w-[54%] items-center justify-center">
            <ProductImage
              src="/products/hero-collage.png"
              alt="Featured devices"
              className="max-h-full max-w-full"
            />
          </div>
        </div>

        {/* benefits */}
        <div className="mb-6 grid grid-cols-4 gap-3">
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="flex min-h-[61px] items-center gap-3 rounded-[10px] border border-[var(--line)] px-3 py-2.5"
            >
              <b.icon size={20} className="shrink-0 text-[var(--store-blue)]" />
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold text-[var(--ink)]">{b.title}</span>
                <span className="mt-0.5 block text-[10px] text-[var(--gray-2)]">{b.sub}</span>
              </span>
            </div>
          ))}
        </div>

        {/* featured products */}
        <div className="mb-4 flex items-center justify-between">
          <h4 className="text-[17px] font-semibold text-[var(--ink)]">Featured Products</h4>
          <a href="#" className="text-[12px] text-[var(--store-blue)]">
            See All
          </a>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {PRODUCTS.map((p) => (
            <div
              key={p.id}
              className="relative min-w-0 rounded-[10px] border border-[#e4e4e6] p-2.5 pb-3"
            >
              <span className="absolute right-2 top-2 text-[var(--gray-2)]">
                <Bookmark size={15} />
              </span>
              <ProductImage src={p.img} alt={p.name} className="h-[123px] w-full" />
              <span className="mt-2 block truncate text-[11px] text-[var(--ink)]">{p.name}</span>
              <span className="mt-1.5 block text-[10px] text-[var(--gray-1)]">{p.priceLabel}</span>
              {p.colors.length > 0 && (
                <span className="mt-2 flex gap-1">
                  {p.colors.map((c) => (
                    <i key={c} className="h-2 w-2 rounded-full" style={{ background: c }} />
                  ))}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
