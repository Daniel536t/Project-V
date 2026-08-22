import { Apple, Search, ShoppingBag } from 'lucide-react';

const LINKS = ['Store', 'Mac', 'iPad', 'iPhone', 'Watch', 'AirPods', 'Accessories', 'Support'];

export default function NavBar() {
  return (
    <header className="sticky top-0 z-10 flex h-12 items-center gap-7 bg-white/80 px-8 backdrop-blur-sm">
      <Apple size={16} fill="currentColor" />
      {LINKS.map((l) => (
        <a
          key={l}
          href="#"
          className={`text-[13px] ${
            l === 'Store'
              ? 'font-medium text-black'
              : 'text-[#1d1d1f]/80 transition hover:text-black'
          }`}
        >
          {l}
        </a>
      ))}
      <div className="ml-auto flex gap-5 text-[#1d1d1f]">
        <Search size={17} />
        <ShoppingBag size={17} />
      </div>
    </header>
  );
}
