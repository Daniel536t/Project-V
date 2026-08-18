"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * A "dimensional jump" title card that plays once per session,
 * then scales away to reveal the page. Click anywhere to skip.
 */
export default function PortalIntro() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem("oracle-intro-seen") === "1";
    } catch {
      seen = false;
    }
    if (!seen) {
      setShow(true);
      try {
        sessionStorage.setItem("oracle-intro-seen", "1");
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(false), 1800);
    return () => clearTimeout(t);
  }, [show]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          onClick={() => setShow(false)}
          className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center gap-6 overflow-hidden bg-ink"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.35 }}
          transition={{ duration: 0.45, ease: "easeIn" }}
        >
          <motion.div
            className="portal"
            initial={{ scale: 0.2, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />

          <motion.h1
            initial={{ opacity: 0, scale: 0.7, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.35, type: "spring", stiffness: 140, damping: 12 }}
            data-text="ORACLE"
            className="glitch chromatic--hard font-display text-6xl text-foreground sm:text-8xl"
          >
            ORACLE
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="font-display text-xl tracking-[0.4em] text-spider-blue"
          >
            INTO THE SCRAPE-VERSE
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
