"use client";

import { useState } from "react";

interface DimensionalSliderProps {
  min: number;
  max: number;
  defaultValue?: number;
  onChange?: (year: number) => void;
}

/** Time navigation — slide across the scrape-verse's dimensions (years). */
export default function DimensionalSlider({
  min,
  max,
  defaultValue,
  onChange,
}: DimensionalSliderProps) {
  const [value, setValue] = useState(defaultValue ?? max);

  function handleChange(next: number) {
    setValue(next);
    onChange?.(next);
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between font-display tracking-wider">
        <span className="text-spider-blue">DIMENSION</span>
        <span className="text-2xl text-foreground">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => handleChange(Number(e.target.value))}
        aria-label="Timeline year"
        className="mt-3 w-full cursor-pointer accent-spider-red"
      />
      <div className="mt-1 flex justify-between text-xs text-foreground/40">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
