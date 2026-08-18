"use client";

import { motion } from "framer-motion";

type Props = {
  title: string;
  description: string;
  icon: string;
  accent: string;
};

export default function QuestionTypeCard({
  title,
  description,
  icon,
  accent,
}: Props) {
  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="rounded-2xl border border-white/10 bg-panel/60 p-6 text-left backdrop-blur transition-colors hover:border-white/25"
    >
      <div
        className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${accent}`}
      >
        {icon}
      </div>
      <h3 className="font-display text-2xl tracking-wide">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-foreground/60">
        {description}
      </p>
    </motion.div>
  );
}
