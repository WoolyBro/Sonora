"use client";

/**
 * Kinetic type: motion that lives in the letters themselves.
 *
 *   ProximityText / useProximityWeight  letters swell heavier and softer near the cursor
 *   BlurType                            words come into focus one after another
 *   CyclingWord                         one word that keeps changing, through a blur
 *   FeelingsTicker                      feeling words drifting along a slow wave
 *   MoodReel                            the eight moods turning past like a dial
 *   OrbitText                           a phrase circling a point, like a record label
 *
 * Everything pauses off-screen, respects reduced motion, and keeps the real
 * text available to screen readers once (animated copies are aria-hidden).
 */
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Fragment, useEffect, useRef, useState, type ElementType, type ReactNode, type RefObject } from "react";

import { EMOTIONS, EMOTION_INFO, type Emotion } from "@/lib/emotion/taxonomy";

import { MOOD_TYPE, MOOD_TYPE_SCALE } from "./moodType";
import { EASE_OUT } from "./Reveal";

/* ------------------------------------------------------------------ */
/* Shared pointer: one listener for every proximity effect on the page */

const pointer = { x: -1e5, y: -1e5 };
const wakers = new Set<() => void>();
let tracking = false;

function trackPointer() {
  if (tracking || typeof window === "undefined") return;
  tracking = true;
  const wakeAll = () => wakers.forEach((w) => w());
  window.addEventListener(
    "pointermove",
    (e) => {
      if (e.pointerType === "touch") return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      wakeAll();
    },
    { passive: true },
  );
  document.documentElement.addEventListener("pointerleave", () => {
    pointer.x = pointer.y = -1e5;
    wakeAll();
  });
  window.addEventListener("scroll", wakeAll, { passive: true });
}

/**
 * Letters marked `data-prox` inside `ref` get heavier and rounder (Fraunces'
 * wght and SOFT axes) the closer the cursor is, then ease back when it leaves.
 * Runs only while something is changing; off for touch and reduced motion.
 */
export function useProximityWeight(ref: RefObject<HTMLElement | null>, { lift = 320 }: { lift?: number } = {}) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(hover: none), (prefers-reduced-motion: reduce)").matches) return;
    trackPointer();

    let letters: HTMLElement[] = [];
    let current = new Float32Array(0);
    let soft: number[] = [];
    let keep: string[] = []; // each letter's other axes (wdth, opsz…), preserved while we change weight
    let baseWeight = 400;
    let sigma = 48;

    const measure = () => {
      letters = Array.from(root.querySelectorAll<HTMLElement>("[data-prox]"));
      current = new Float32Array(letters.length);
      // Read each letter's own SOFT before we ever touch it (the italic "soundtrack." is already soft).
      keep = [];
      soft = letters.map((l) => {
        l.style.fontVariationSettings = "";
        const fvs = getComputedStyle(l).fontVariationSettings;
        const m = /"SOFT"\s+([\d.]+)/.exec(fvs);
        const others = fvs === "normal" ? [] : fvs.split(",").map((x) => x.trim()).filter((x) => !/^"(wght|SOFT)"/.test(x));
        keep.push(others.length ? `${others.join(", ")}, ` : "");
        return m ? Number(m[1]) : 0;
      });
      const cs = getComputedStyle(root);
      baseWeight = Number(cs.fontWeight) || 400;
      sigma = parseFloat(cs.fontSize) * 0.9 || 48;
    };

    let raf = 0;
    const frame = () => {
      raf = 0;
      const r = root.getBoundingClientRect();
      const pad = sigma * 3;
      const near = pointer.x > r.left - pad && pointer.x < r.right + pad && pointer.y > r.top - pad && pointer.y < r.bottom + pad;
      // Read every position first, then write, so the browser lays out once.
      const targets = letters.map((l) => {
        if (!near) return 0;
        const b = l.getBoundingClientRect();
        const dx = b.left + b.width / 2 - pointer.x;
        const dy = b.top + b.height / 2 - pointer.y;
        return Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      });
      let moving = false;
      letters.forEach((l, i) => {
        const next = current[i] + (targets[i] - current[i]) * 0.18;
        if (Math.abs(targets[i] - next) > 0.002) moving = true;
        current[i] = next;
        l.style.fontVariationSettings =
          next < 0.004 ? "" : `${keep[i]}"wght" ${Math.round(baseWeight + lift * next)}, "SOFT" ${Math.round(soft[i] + (100 - soft[i]) * next)}`;
      });
      if (moving) raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    wakers.add(wake);
    return () => {
      wakers.delete(wake);
      ro.disconnect();
      cancelAnimationFrame(raf);
      letters.forEach((l) => (l.style.fontVariationSettings = ""));
    };
  }, [ref, lift]);
}

/** A word split into proximity letters. Inline spans, so gradient text still clips through them. */
export function ProxLetters({ word }: { word: string }) {
  return (
    <>
      {Array.from(word).map((ch, i) => (
        <span key={i} data-prox="">
          {ch}
        </span>
      ))}
    </>
  );
}

/** Applies the proximity effect to any `data-prox` letters inside it (e.g. SplitWords with `letters`). */
export function ProximityGroup({
  as: Tag = "span",
  id,
  className,
  children,
}: {
  as?: ElementType;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useProximityWeight(ref);
  return (
    <Tag ref={ref} id={id} className={className}>
      {children}
    </Tag>
  );
}

/** Words split into proximity letters (no tracking of its own: put it inside a ProximityGroup). */
export function ProxWords({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((w, i) => (
          <Fragment key={i}>
            <span className="whitespace-nowrap">
              <ProxLetters word={w} />
            </span>
            {i < words.length - 1 && " "}
          </Fragment>
        ))}
      </span>
    </>
  );
}

/** Text whose letters respond to the cursor. */
export function ProximityText({ text, as = "span", className }: { text: string; as?: ElementType; className?: string }) {
  return (
    <ProximityGroup as={as} className={className}>
      <ProxWords text={text} />
    </ProximityGroup>
  );
}

/* ------------------------------------------------------------------ */

/** Words resolve from a blur one after another. Re-runs whenever `text` changes. */
export function BlurType({ text, className, stagger = 0.035, delay = 0.15 }: { text: string; className?: string; stagger?: number; delay?: number }) {
  const words = text.split(" ");
  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <motion.span
        key={text}
        aria-hidden="true"
        initial="hidden"
        animate="shown"
        variants={{ hidden: {}, shown: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
      >
        {words.map((w, i) => (
          <Fragment key={i}>
            <motion.span
              className="inline-block"
              variants={{
                hidden: { opacity: 0, filter: "blur(10px)", y: "0.2em" },
                shown: { opacity: 1, filter: "blur(0px)", y: 0, transition: { duration: 0.6, ease: EASE_OUT } },
              }}
            >
              {w}
            </motion.span>
            {i < words.length - 1 && " "}
          </Fragment>
        ))}
      </motion.span>
    </span>
  );
}

/** A single word that keeps changing, each one blurring in as the last drifts up and away. */
export function CyclingWord({ words, interval = 2400, className }: { words: string[]; interval?: number; className?: string }) {
  const [i, setI] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => setI((n) => (n + 1) % words.length), interval);
    return () => window.clearInterval(id);
  }, [words.length, interval, reduced]);
  return (
    <span className={`relative inline-grid ${className ?? ""}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={words[i]}
          className="col-start-1 row-start-1 whitespace-nowrap"
          initial={{ opacity: 0, filter: "blur(8px)", y: "0.45em" }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          exit={{ opacity: 0, filter: "blur(8px)", y: "-0.45em" }}
          transition={{ duration: 0.55, ease: EASE_OUT }}
        >
          {words[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/* ------------------------------------------------------------------ */

/** A deterministic, music-like contour of bar heights as Wavefont digits (0 = low, 9 = high). */
function contour(length: number, seed: number) {
  let out = "";
  for (let i = 0; i < length; i++) {
    const v = 0.5 + 0.5 * Math.sin(i * 0.55 + seed) * Math.sin(i * 0.17 + seed * 2) + 0.18 * Math.sin(i * 1.9 + seed * 3);
    out += String(Math.max(0, Math.min(9, Math.round(v * 9))));
  }
  return out;
}

/**
 * A waveform made of type: Wavefont draws each digit as a bar, so a string
 * of digits reads as audio. It scrolls slowly while on screen, like a track
 * playing; still for reduced motion. Purely decorative.
 */
export function WaveText({ length = 32, seed = 1, className = "" }: { length?: number; seed?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shift, setShift] = useState(0);
  const reduced = useReducedMotion();
  const base = contour(length * 2, seed);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    let id = 0;
    const io = new IntersectionObserver(([entry]) => {
      window.clearInterval(id);
      if (entry.isIntersecting) id = window.setInterval(() => setShift((n) => (n + 1) % length), 160);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearInterval(id);
    };
  }, [reduced, length]);

  return (
    <span ref={ref} aria-hidden="true" className={`font-wave select-none whitespace-nowrap ${className}`}>
      {base.slice(shift, shift + length)}
    </span>
  );
}

/* ------------------------------------------------------------------ */

const inkFor = (accent: string, amount = 55) => `color-mix(in oklab, ${accent} ${amount}%, #2a1f5c)`;

/** Feeling words in each mood's colour and typeface, interleaved so neighbours differ. */
function tickerWords() {
  const out: { word: string; colour: string; mood: Emotion }[] = [];
  const longest = Math.max(...EMOTIONS.map((e) => EMOTION_INFO[e].examples.length));
  for (let k = 0; k < longest; k++) {
    for (const e of EMOTIONS) {
      const w = EMOTION_INFO[e].examples[k];
      if (w) out.push({ word: w, colour: inkFor(EMOTION_INFO[e].accent), mood: e });
    }
  }
  return out;
}

const TICKER_WORDS = tickerWords();

const TICKER_W = 1600;
const TICKER_H = 170;

function wavePath() {
  const amp = 26;
  const mid = TICKER_H / 2;
  const len = 800;
  let d = `M ${-120} ${mid}`;
  for (let x = -120; x <= TICKER_W + 120; x += 20) {
    d += ` L ${x} ${(mid + amp * Math.sin(((x + 120) / len) * Math.PI * 2)).toFixed(1)}`;
  }
  return d;
}

/**
 * A band of feeling words riding a slow sine wave across the page. Hovering
 * slows it right down so a word can be read; it stops off-screen and is still
 * for reduced motion.
 */
export function FeelingsTicker({ className = "" }: { className?: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<SVGTextPathElement>(null);
  const words = TICKER_WORDS;

  useEffect(() => {
    const wrap = wrapRef.current;
    const tp = textRef.current;
    if (!wrap || !tp) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const text = tp.parentElement as unknown as SVGTextElement;
    const repLength = text.getComputedTextLength() / 2; // content is rendered twice
    let offset = 0;
    let speed = 1;
    let target = 1;
    let last = performance.now();
    let raf = 0;
    let visible = false;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(250, now - last); // time-based, so slow frames don't slow the drift
      last = now;
      speed += (target - speed) * 0.06;
      offset -= 0.045 * dt * speed;
      if (offset < -repLength) offset += repLength;
      tp.setAttribute("startOffset", offset.toFixed(1));
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      }
    });
    io.observe(wrap);
    const slow = () => (target = 0.18);
    const resume = () => (target = 1);
    wrap.addEventListener("pointerenter", slow);
    wrap.addEventListener("pointerleave", resume);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      wrap.removeEventListener("pointerenter", slow);
      wrap.removeEventListener("pointerleave", resume);
    };
  }, []);

  const run = (rep: number) =>
    words.map(({ word, colour, mood }, i) => (
      <Fragment key={`${rep}-${i}`}>
        <tspan style={{ ...MOOD_TYPE[mood], fill: colour, fontSize: 46 * MOOD_TYPE_SCALE[mood] }} dx={rep === 0 && i === 0 ? 0 : 24}>
          {word}
        </tspan>
        <tspan style={{ fill: "var(--warm)" }} dx="24" fontSize="26" fontStyle="normal">
          ✦
        </tspan>
      </Fragment>
    ));

  return (
    <div ref={wrapRef} className={`relative overflow-hidden ${className}`}>
      <p className="sr-only">Feelings Sonora listens for: {words.map((w) => w.word).join(", ")}.</p>
      <svg aria-hidden="true" viewBox={`0 0 ${TICKER_W} ${TICKER_H}`} preserveAspectRatio="xMidYMid slice" className="block h-[110px] w-full sm:h-[150px]">
        <defs>
          <path id="feelings-wave" d={wavePath()} />
          <linearGradient id="feelings-fade" x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.12" stopColor="#fff" stopOpacity="1" />
            <stop offset="0.88" stopColor="#fff" stopOpacity="1" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="feelings-mask">
            <rect width={TICKER_W} height={TICKER_H} fill="url(#feelings-fade)" />
          </mask>
        </defs>
        <g mask="url(#feelings-mask)">
          <path d={wavePath()} fill="none" stroke="var(--atmo-ink)" strokeOpacity="0.12" strokeWidth="1.5" strokeDasharray="2 10" strokeLinecap="round" transform="translate(0 30)" />
          <text className="font-accent" fontSize="46" dominantBaseline="middle">
            <textPath ref={textRef} href="#feelings-wave" startOffset="0">
              {run(0)}
              {run(1)}
            </textPath>
          </text>
        </g>
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */

const ROW = 58;

/**
 * The eight moods on a turning dial: the centred one large and in its own
 * colour, neighbours fading above and below. Turns on its own; hover or focus
 * pauses it, and any mood can be picked.
 */
export function MoodReel({ className = "" }: { className?: string }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const n = EMOTIONS.length;

  useEffect(() => {
    if (paused || reduced) return;
    const id = window.setInterval(() => setActive((a) => (a + 1) % n), 1900);
    return () => window.clearInterval(id);
  }, [paused, reduced, n]);

  const info = EMOTION_INFO[EMOTIONS[active]];
  return (
    <div
      className={className}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <ul
        aria-label="The eight moods Sonora reads"
        className="relative w-full [mask-image:linear-gradient(to_bottom,transparent,#000_28%,#000_72%,transparent)]"
        style={{ height: ROW * 5 }}
      >
        {EMOTIONS.map((e, i) => {
          const half = Math.floor(n / 2);
          const off = ((((i - active) % n) + n + half) % n) - half;
          const on = off === 0;
          const hidden = Math.abs(off) > 2;
          const eInfo = EMOTION_INFO[e];
          return (
            <motion.li
              key={e}
              className="absolute inset-x-0 top-1/2 -mt-[29px] flex h-[58px] origin-left items-center"
              initial={false}
              animate={{ y: off * ROW, scale: on ? 1 : 0.62, opacity: hidden ? 0 : on ? 1 : Math.abs(off) === 1 ? 0.85 : 0.4 }}
              transition={{ type: "spring", stiffness: 140, damping: 22 }}
            >
              <button
                type="button"
                tabIndex={Math.abs(off) > 1 ? -1 : 0} // the faded edges of the dial stay clickable, not tab stops
                aria-pressed={on}
                onClick={() => setActive(i)}
                className="flex h-full items-center gap-3 whitespace-nowrap leading-none transition-colors duration-500 focus-visible:outline-none focus-visible:underline"
                style={{
                  ...MOOD_TYPE[e],
                  fontSize: `calc(clamp(1.6rem, 5.6vw, 2.2rem) * ${MOOD_TYPE_SCALE[e]})`,
                  color: on ? inkFor(eInfo.accent, 62) : "var(--text-muted)",
                }}
              >
                <motion.span
                  aria-hidden="true"
                  className="h-3 w-3 rounded-full"
                  animate={{ scale: on ? 1 : 0, opacity: on ? 1 : 0 }}
                  style={{ background: eInfo.accent }}
                />
                {eInfo.label}
              </button>
            </motion.li>
          );
        })}
      </ul>
      <div className="mt-3 min-h-[2.5rem] max-w-sm" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={info.label}
            className="text-sm leading-relaxed text-muted"
            initial={{ opacity: 0, filter: "blur(6px)", y: 6 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            exit={{ opacity: 0, filter: "blur(6px)", y: -6 }}
            transition={{ duration: 0.4, ease: EASE_OUT }}
          >
            {info.description}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * A phrase circling a small disc, like a record label, turning while
 * something plays and resting when it doesn't.
 */
export function OrbitText({
  text,
  spinning,
  colour,
  className = "",
}: {
  text: string;
  spinning: boolean;
  colour: string;
  className?: string;
}) {
  const r = 38;
  const circumference = 2 * Math.PI * r;
  return (
    <div aria-hidden="true" className={`grid place-items-center rounded-full bg-surface-strong shadow-lg shadow-[rgb(42_32_78/0.12)] ring-1 ring-ink/10 backdrop-blur-md ${className}`}>
      <svg viewBox="0 0 100 100" className="h-full w-full" style={{ animation: "label-spin 14s linear infinite", animationPlayState: spinning ? "running" : "paused" }}>
        <defs>
          <path id="orbit-ring" d={`M 50 ${50 - r} a ${r} ${r} 0 1 1 0 ${2 * r} a ${r} ${r} 0 1 1 0 ${-2 * r}`} />
        </defs>
        <text fontSize="10.5" fontWeight="600" letterSpacing="1.6" style={{ fill: colour, textTransform: "uppercase" }}>
          <textPath href="#orbit-ring" textLength={circumference - 4} lengthAdjust="spacing">
            {text}
          </textPath>
        </text>
        <circle cx="50" cy="50" r="5" style={{ fill: colour }} />
      </svg>
    </div>
  );
}
