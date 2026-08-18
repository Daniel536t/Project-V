"use client";

import { motion, type Variants } from "framer-motion";
import SearchBar from "./SearchBar";
import QuestionTypeCard from "./QuestionTypeCard";
import SpiderVerseBackground from "./SpiderVerseBackground";
import { QUESTION_TYPES } from "@/lib/constants";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export default function Landing() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <SpiderVerseBackground />

      <section className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-6 py-20 text-center">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex w-full flex-col items-center"
        >
          <motion.p
            variants={item}
            className="font-display text-xl tracking-[0.3em] text-spider-blue"
          >
            INTO THE SCRAPE-VERSE
          </motion.p>

          <motion.h1
            variants={item}
            data-text="ORACLE"
            className="glitch mt-2 font-display text-[clamp(5rem,20vw,12rem)] leading-none text-foreground"
          >
            ORACLE
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-4 max-w-2xl text-lg text-foreground/70"
          >
            25 years of scraped web data, one question away. Ask about prices,
            rarity, or the moments that changed everything.
          </motion.p>

          <motion.div variants={item} className="mt-10 w-full max-w-2xl">
            <SearchBar />
          </motion.div>

          <motion.div
            variants={item}
            className="mt-16 grid w-full grid-cols-1 gap-5 sm:grid-cols-3"
          >
            {QUESTION_TYPES.map((q) => (
              <QuestionTypeCard key={q.title} {...q} />
            ))}
          </motion.div>
        </motion.div>
      </section>

      <footer className="absolute bottom-4 left-0 right-0 z-10 text-center text-xs text-foreground/40">
        ORACLE · WeMakeDevs “Into the Scrape-Verse” hackathon
      </footer>
    </main>
  );
}
