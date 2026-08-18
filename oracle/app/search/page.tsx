import Link from "next/link";

export default function SearchPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const raw = searchParams?.q;
  const q = Array.isArray(raw) ? raw[0] : raw ?? "";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-xl tracking-[0.3em] text-spider-blue">
        CONSULTING THE ORACLE
      </p>
      <h1 className="mt-4 max-w-2xl font-display text-4xl leading-tight tracking-wide sm:text-5xl">
        “{q || "Your question"}”
      </h1>
      <p className="mt-6 max-w-xl text-foreground/60">
        The analysis pipeline (price, rarity, timeline) lands in the next batch.
        This is where the answer will render.
      </p>
      <Link
        href="/"
        className="mt-10 rounded-xl bg-spider-red px-6 py-3 font-display text-lg tracking-wider text-white transition hover:bg-spider-pink"
      >
        ← BACK TO ORACLE
      </Link>
    </main>
  );
}
