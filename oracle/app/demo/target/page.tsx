"use client";

import { useEffect, useState } from "react";

interface DemoState {
  product: { name: string; price: number; inStock: boolean };
  template: number;
  botDetection: boolean;
  hits: number;
  templates?: Record<string, { name: string; price: string; stock: string }>;
}

export default function DemoTarget() {
  const [state, setState] = useState<DemoState | null>(null);

  useEffect(() => {
    fetch("/api/demo")
      .then((r) => r.json())
      .then(setState);
  }, []);

  if (!state) {
    return <div className="p-8 font-sans text-white">Loading…</div>;
  }

  const p = state.product;
  const t = state.template;
  const tmpl = state.templates?.[String(t)];

  return (
    <main className="min-h-screen bg-white font-sans text-black">
      <div className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-xs text-gray-400">
          Demo target — a controllable product page. This is what the SENSE
          collector watches.
        </p>

        <div className="mt-8 rounded-xl border border-gray-200 p-8 shadow-sm">
          {t === 0 && (
            <div>
              <h1 className="text-2xl font-semibold">{p.name}</h1>
              <div className="price mt-3 text-3xl font-bold text-green-700">
                ${p.price}
              </div>
              <div className="stock mt-1 text-gray-600">
                {p.inStock ? "In stock" : "Out of stock"}
              </div>
            </div>
          )}
          {t === 1 && (
            <div className="product-meta">
              <h1 className="text-2xl font-semibold">{p.name}</h1>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="current-price text-3xl font-bold text-green-700">
                  ${p.price}
                </span>
                <span className="stock-status text-gray-600">
                  {p.inStock ? "In stock" : "Out of stock"}
                </span>
              </div>
            </div>
          )}
          {t === 2 && (
            <div>
              <h1 className="text-2xl font-semibold">{p.name}</h1>
              <div data-test="price-value" className="mt-3 text-3xl font-bold text-green-700">
                ${p.price}
              </div>
              <div data-test="availability" className="mt-1 text-gray-600">
                {p.inStock ? "In stock" : "Out of stock"}
              </div>
            </div>
          )}
        </div>

        <p className="mt-8 text-xs text-gray-400">
          Template: {tmpl?.name ?? t} · price selector{" "}
          <code>{tmpl?.price}</code> · stock selector <code>{tmpl?.stock}</code>
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Open{" "}
          <a href="/demo/admin" className="text-blue-600 underline">
            demo controls
          </a>{" "}
          to redesign this page or drop the price.
        </p>
      </div>
    </main>
  );
}
