"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { EASE_OUT } from "@/components/motion/Reveal";

/** Re-mounts on every navigation, so each page eases in. */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE_OUT }}>
      {children}
    </motion.div>
  );
}
