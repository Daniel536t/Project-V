"use client";

import { useEffect, useState } from "react";

interface Watch {
  id: string;
  label: string | null;
  url: string;
  field: string;
  operator: string;
  target: string | null;
  status: string;
  last_value: string | null;
  selector: string | null;
  scar_count: number;
}

// Placeholder for the "other site" — the console/reveal. Built next.
export default function ConsolePage() {
  const [watches, setWatches] = useState<Watch[]>([]);

  useEffect(() => {
    fetch("/api/watches")
      .then((r) => r.json())
      .then((d) => setWatches(d.watches ?? []));
  }, []);

  return (
    <main className="min-h-screen bg-background p-8 font-sans text-foreground">
      <div className="mx-auto max-w-3xl">
        <p className="text-2xl font-semibold">Console</p>
        <p className="mt-1 text-sm text-foreground/50">
          The reveal — the machinery behind the agent. Full build coming next.
        </p>

        {watches.length === 0 ? (
          <p className="mt-8 text-sm text-foreground/50">
            No watches yet. Go talk to{" "}
            <a href="/" className="text-spider-blue underline">
              SENSE
            </a>{" "}
            and create one.
          </p>
        ) : (
          <div className="mt-6 space-y-3">
            {watches.map((w) => (
              <div
                key={w.id}
                className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{w.label ?? w.id}</span>
                  <span className="text-xs uppercase tracking-wide text-foreground/50">
                    {w.status}
                  </span>
                </div>
                <div className="mt-2 text-xs text-foreground/60">
                  <span className="mr-3">id: {w.id}</span>
                  <span className="mr-3">
                    {w.field} {w.operator} {w.target ?? ""}
                  </span>
                  <span className="mr-3">last: {w.last_value ?? "—"}</span>
                  <span>selector: {w.selector ?? "—"}</span>
                  {w.scar_count > 0 && (
                    <span className="ml-3 text-spider-red">
                      🕸️ scar #{w.scar_count}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
