import SpiderSenseChat from "@/components/SpiderSenseChat";

export default function AskPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const raw = searchParams?.q;
  const q = Array.isArray(raw) ? raw[0] : raw ?? "";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6 py-16">
      <p className="font-display text-xl tracking-[0.3em] text-spider-blue">
        CONSULTING THE ORACLE
      </p>
      <h1 className="mt-2 font-display text-5xl tracking-wide text-foreground">
        Ask anything.
      </h1>
      <p className="mt-3 text-foreground/60">
        Price predictions, rarity checks, and timeline lookups — answered from
        25 years of scraped web data. Tap the 🕸️ bubble to chat with SENSE.
      </p>

      <SpiderSenseChat initialQuestion={q} />
    </main>
  );
}
