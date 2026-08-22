import { HERO_IMAGES } from '@/lib/store-shared';

export default function Hero() {
  return (
    <div className="mt-3 flex min-h-[280px] overflow-hidden rounded-[18px] bg-[var(--card)]">
      <div className="self-center p-10 lg:p-12">
        <h2 className="text-[42px] font-semibold leading-[1.06] tracking-tight">
          New season.
          <br />
          Elevated.
        </h2>
        <p className="mt-3.5 text-[15px] text-[var(--gray-1)]">
          Explore the latest in tech,
          <br />
          style, and everyday essentials.
        </p>
        <button className="mt-6 rounded-full bg-[var(--store-blue)] px-6 py-2.5 text-[15px] font-medium text-white transition hover:bg-[var(--store-blue-hover)]">
          Shop Now
        </button>
      </div>
      <div className="relative flex flex-1 items-end justify-center gap-6 p-6">
        <img
          src={HERO_IMAGES.buds}
          alt="AirPods Pro"
          className="w-[100px] object-contain opacity-95"
        />
        <img
          src={HERO_IMAGES.phone}
          alt="iPhone 17 Pro"
          className="w-[180px] object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.18)]"
        />
        <img
          src={HERO_IMAGES.watch}
          alt="Apple Watch"
          className="w-[100px] object-contain opacity-95"
        />
      </div>
    </div>
  );
}
