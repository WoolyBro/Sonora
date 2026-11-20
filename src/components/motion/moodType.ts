/**
 * Every feeling has its own voice. The faces are all quiet, light serifs plus
 * one script and one thin sans, so they differ in character without any of
 * them shouting. Used where moods are shown as words (the feelings ticker and
 * the mood reel on the landing page).
 *
 * preload: false, so a font is only downloaded when a page actually draws a
 * word in it; pages that never show these words never fetch them.
 */
import {
  Bodoni_Moda,
  Cormorant_Garamond,
  Fraunces,
  Italiana,
  Jost,
  Ms_Madi,
  Newsreader,
  Playfair_Display,
} from "next/font/google";
import type { CSSProperties } from "react";

import type { Emotion } from "@/lib/emotion/taxonomy";

// Thin, drooping italic serif.
const low = Cormorant_Garamond({ subsets: ["latin"], weight: "300", style: "italic", display: "swap", preload: false });
// A fine, slightly hurried italic.
const anxious = Newsreader({ subsets: ["latin"], weight: "300", style: "italic", display: "swap", preload: false });
// Firm and high-contrast, but still a book face.
const angry = Playfair_Display({ subsets: ["latin"], weight: "600", display: "swap", preload: false });
// Taut hairlines, pulled tight.
const stressed = Bodoni_Moda({ subsets: ["latin"], style: "italic", axes: ["opsz"], display: "swap", preload: false });
// Flat, thin, nothing behind it.
const numb = Jost({ subsets: ["latin"], weight: "200", display: "swap", preload: false });
// Soft, round, a little wonky.
const joyful = Fraunces({ subsets: ["latin"], axes: ["SOFT", "WONK", "opsz"], display: "swap", preload: false });
// A warm handwritten script.
const warm = Ms_Madi({ subsets: ["latin"], weight: "400", display: "swap", preload: false });
// Tall, airy, unhurried.
const calm = Italiana({ subsets: ["latin"], weight: "400", display: "swap", preload: false });

/** Font settings per mood. Every entry sets its style explicitly so it never inherits an italic. */
export const MOOD_TYPE: Record<Emotion, CSSProperties> = {
  LOW_SAD: { fontFamily: low.style.fontFamily, fontStyle: "italic", fontWeight: 300 },
  ANXIOUS_WORRIED: { fontFamily: anxious.style.fontFamily, fontStyle: "italic", fontWeight: 300 },
  ANGRY_FRUSTRATED: { fontFamily: angry.style.fontFamily, fontStyle: "normal", fontWeight: 600 },
  STRESSED_OVERWHELMED: { fontFamily: stressed.style.fontFamily, fontStyle: "italic", fontWeight: 400, fontVariationSettings: '"opsz" 96' },
  NUMB_DISCONNECTED: { fontFamily: numb.style.fontFamily, fontStyle: "normal", fontWeight: 200, letterSpacing: "0.02em" },
  POSITIVE_JOYFUL: { fontFamily: joyful.style.fontFamily, fontStyle: "normal", fontWeight: 400, fontVariationSettings: '"SOFT" 100, "WONK" 1, "opsz" 72' },
  AFFECTIONATE_CONNECTED: { fontFamily: warm.style.fontFamily, fontStyle: "normal", fontWeight: 400 },
  CALM_PEACEFUL: { fontFamily: calm.style.fontFamily, fontStyle: "normal", fontWeight: 400 },
};

/**
 * Optical size correction: the same font-size looks different across these
 * faces (a script runs small, a thin sans runs light), so each is scaled to sit
 * at a similar visual size beside the others.
 */
export const MOOD_TYPE_SCALE: Record<Emotion, number> = {
  LOW_SAD: 1.1,
  ANXIOUS_WORRIED: 0.98,
  ANGRY_FRUSTRATED: 0.9,
  STRESSED_OVERWHELMED: 0.94,
  NUMB_DISCONNECTED: 0.9,
  POSITIVE_JOYFUL: 0.94,
  AFFECTIONATE_CONNECTED: 1.25,
  CALM_PEACEFUL: 0.98,
};
