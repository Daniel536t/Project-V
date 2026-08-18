"use client";

import { useState } from "react";
import ImageUpload from "@/components/ImageUpload";

export default function ValuatePage() {
  const [result, setResult] = useState<unknown>(null);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-16">
      <p className="font-display text-xl tracking-[0.3em] text-spider-purple">
        SCARCITY SCAN
      </p>
      <h1 className="chromatic mt-2 font-display text-5xl tracking-wide text-foreground">
        Is it actually rare?
      </h1>
      <span className="onomatopoeia--cyan onomatopoeia mt-2 text-2xl">SCAN!</span>
      <p className="mt-3 text-foreground/60">
        Upload a photo — ORACLE identifies the item, assesses condition, and
        estimates scarcity and value.
      </p>

      <div className="mt-10">
        <ImageUpload onResult={setResult} />
      </div>

      {result !== null && (
        <pre className="mt-6 overflow-x-auto rounded-2xl border border-foreground/10 bg-panel/80 p-5 text-sm text-foreground/80">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </main>
  );
}
