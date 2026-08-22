import { Lock, Phone, RotateCcw, Truck } from 'lucide-react';

const ITEMS = [
  { icon: Truck, title: 'Free shipping', sub: 'On orders over $50' },
  { icon: RotateCcw, title: '30-day returns', sub: 'Hassle-free returns' },
  { icon: Lock, title: 'Secure payment', sub: '100% secure checkout' },
  { icon: Phone, title: 'Specialist support', sub: "We're here to help" },
];

export default function FeatureRow() {
  return (
    <div className="mt-5 grid grid-cols-4 gap-4">
      {ITEMS.map((i) => (
        <div key={i.title} className="rounded-[14px] bg-[var(--card)] px-3 py-4 text-center">
          <i.icon size={20} className="mx-auto text-[var(--store-blue)]" />
          <div className="mt-2 text-[13px] font-semibold">{i.title}</div>
          <div className="text-[12px] text-[var(--gray-1)]">{i.sub}</div>
        </div>
      ))}
    </div>
  );
}
