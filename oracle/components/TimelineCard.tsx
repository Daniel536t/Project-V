interface TimelineCardProps {
  year: number;
  title: string;
  description: string;
  accent?: string;
}

/** Shareable data-story card for a timeline inflection point. */
export default function TimelineCard({
  year,
  title,
  description,
  accent = "text-spider-red",
}: TimelineCardProps) {
  return (
    <div className="rounded-2xl border border-foreground/10 bg-panel/80 p-5 backdrop-blur transition hover:border-spider-red/60">
      <p className={`font-display text-2xl tracking-wider ${accent}`}>{year}</p>
      <h3 className="mt-2 font-display text-xl tracking-wide text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-foreground/60">
        {description}
      </p>
    </div>
  );
}
