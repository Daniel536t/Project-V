"use client";

interface DimensionalSliderProps {
  min: number;
  max: number;
  value: number;
  onChange?: (year: number) => void;
}

/** Time navigation — slide across the scrape-verse's dimensions (years). */
export default function DimensionalSlider({
  min,
  max,
  value,
  onChange,
}: DimensionalSliderProps) {
  return (
    <div className="w-full">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange?.(Number(e.target.value))}
        aria-label="Timeline year"
        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-spider-purple via-spider-pink to-spider-blue accent-spider-red"
      />
      <div className="mt-1 flex justify-between text-xs text-foreground/40">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
