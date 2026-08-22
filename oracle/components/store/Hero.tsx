import { HERO_IMAGES } from '@/lib/store-shared';

export default function Hero() {
  return (
    <div className="mt-3 flex min-h-[280px] overflow-hidden rounded-[18px] bg-[var(--card)]">
      {/* Left: copy */}
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

      {/* Right: three-device cluster — overlapping, tight, Apple-style */}
      <div className="relative flex flex-1 items-end justify-center">
        {/* AirPods — lower-left, behind phone */}
        <img
          src={HERO_IMAGES.buds}
          alt="AirPods Pro"
          className="relative z-0 -mr-8 mb-4 w-[110px] object-contain opacity-95"
        />
        {/* iPhone — tall center hero, overlapping both sides */}
        <img
          src={HERO_IMAGES.phone}
          alt="iPhone 17 Pro"
          className="relative z-10 w-[190px] object-contain drop-shadow-[0_22px_28px_rgba(0,0,0,0.20)]"
        />
        {/* Watch — lower-right, behind phone */}
        <img
          src={HERO_IMAGES.watch}
          alt="Apple Watch"
          className="relative z-0 -ml-8 mb-4 w-[110px] object-contain opacity-95"
        />
      </div>
    </div>
  );
}