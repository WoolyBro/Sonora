"use client";

/**
 * Small, reusable motion primitives. All of them animate only transform,
 * opacity and filter (GPU-friendly), run once, and collapse to a plain fade
 * for people who ask their OS to reduce motion (via <MotionConfig
 * reducedMotion="user"> in Providers).
 */
import { motion, useInView, useMotionValue, useReducedMotion, useTransform, animate, type Variants } from "framer-motion";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Fades and lifts its children into place when they scroll into view. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "section" | "li" | "header";
}) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.8, delay, ease: EASE_OUT }}
    >
      {children}
    </Tag>
  );
}

const container: Variants = {
  hidden: {},
  shown: (stagger: number = 0.08) => ({ transition: { staggerChildren: stagger } }),
};
const item: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  shown: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: EASE_OUT } },
};

/** A group whose <StaggerItem> children cascade in one after another. */
export function Stagger({
  children,
  className,
  stagger = 0.08,
  as = "div",
  immediate = false,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  as?: "div" | "ul" | "ol";
  /** Animate on mount instead of when scrolled into view. */
  immediate?: boolean;
}) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      variants={container}
      custom={stagger}
      initial="hidden"
      {...(immediate ? { animate: "shown" } : { whileInView: "shown", viewport: { once: true, amount: 0.15 } })}
    >
      {children}
    </Tag>
  );
}

export function StaggerItem({
  children,
  className,
  style,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "li";
}) {
  const Tag = motion[as];
  return (
    <Tag className={className} style={style} variants={item}>
      {children}
    </Tag>
  );
}

/**
 * Splits a phrase into words that rise out of a soft blur one by one.
 * Screen readers get the whole phrase once (aria-label); the animated word
 * spans are hidden from them.
 */
export function SplitWords({
  text,
  className,
  wordClassName,
  delay = 0,
  stagger = 0.06,
  immediate = true,
}: {
  text: string;
  className?: string;
  wordClassName?: string;
  delay?: number;
  stagger?: number;
  immediate?: boolean;
}) {
  const words = text.split(" ");
  return (
    <motion.span
      aria-label={text}
      role="text"
      className={className}
      initial="hidden"
      {...(immediate ? { animate: "shown" } : { whileInView: "shown", viewport: { once: true, amount: 0.6 } })}
      variants={{ hidden: {}, shown: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
    >
      {words.map((w, i) => (
        <span key={`${w}-${i}`} aria-hidden="true" className="inline-block overflow-hidden pb-[0.12em] align-bottom">
          <motion.span
            className={`inline-block ${wordClassName ?? ""}`}
            variants={{
              hidden: { y: "0.9em", opacity: 0, filter: "blur(8px)" },
              shown: { y: 0, opacity: 1, filter: "blur(0px)", transition: { duration: 0.9, ease: EASE_OUT } },
            }}
          >
            {w}
          </motion.span>
          {i < words.length - 1 && " "}
        </span>
      ))}
    </motion.span>
  );
}

/** Counts from 0 (or the previous value) up to `value` when it first appears or changes. */
export function CountUp({ value, duration = 1.1, className }: { value: number; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => Math.round(v));

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, ease: EASE_OUT });
    return () => controls.stop();
  }, [inView, value, duration, reduced, mv]);

  return (
    <motion.span ref={ref} className={className} aria-label={String(value)}>
      {rounded}
    </motion.span>
  );
}
