/**
 * Every feeling has its own voice: a typeface chosen to look like the mood it
 * names. Used where moods are shown as words (the feelings ticker and the mood
 * reel on the landing page).
 *
 * preload: false, so a font is only downloaded when a page actually draws a
 * word in it; pages that never show these words never fetch them.
 */
import {
  Climate_Crisis,
  Comfortaa,
  Cormorant_Garamond,
  Dela_Gothic_One,
  Gluten,
  Ms_Madi,
  Shantell_Sans,
  Space_Mono,
} from "next/font/google";
import type { CSSProperties } from "react";

import type { Emotion } from "@/lib/emotion/taxonomy";

// Thin, drooping italic serif.
const low = Cormorant_Garamond({ subsets: ["latin"], weight: "300", style: "italic", display: "swap", preload: false });
// Hand-drawn letters on a bounce axis: they jitter up and down.
const anxious = Shantell_Sans({ subsets: ["latin"], axes: ["BNCE", "INFM"], display: "swap", preload: false });
// Heavy, blunt, loud.
const angry = Dela_Gothic_One({ subsets: ["latin"], weight: "400", display: "swap", preload: false });
// Letters that look like they're melting under the weight of it all.
const stressed = Climate_Crisis({ subsets: ["latin"], axes: ["YEAR"], display: "swap", preload: false });
// Flat, mechanical, nothing behind it.
const numb = Space_Mono({ subsets: ["latin"], weight: "400", display: "swap", preload: false });
// Round, bouncy, a little tipsy.
const joyful = Gluten({ subsets: ["latin"], display: "swap", preload: false });
// A warm handwritten script.
const warm = Ms_Madi({ subsets: ["latin"], weight: "400", display: "swap", preload: false });
// Soft, rounded, unhurried.
const calm = Comfortaa({ subsets: ["latin"], display: "swap", preload: false });

/** Font settings per mood. Every entry sets its style explicitly so it never inherits an italic. */
export const MOOD_TYPE: Record<Emotion, CSSProperties> = {
  LOW_SAD: { fontFamily: low.style.fontFamily, fontStyle: "italic", fontWeight: 300 },
  ANXIOUS_WORRIED: { fontFamily: anxious.style.fontFamily, fontStyle: "normal", fontWeight: 500, fontVariationSettings: '"BNCE" 100, "INFM" 100' },
  ANGRY_FRUSTRATED: { fontFamily: angry.style.fontFamily, fontStyle: "normal", fontWeight: 400 },
  STRESSED_OVERWHELMED: { fontFamily: stressed.style.fontFamily, fontStyle: "normal", fontWeight: 400, fontVariationSettings: '"YEAR" 2025' },
  NUMB_DISCONNECTED: { fontFamily: numb.style.fontFamily, fontStyle: "normal", fontWeight: 400 },
  POSITIVE_JOYFUL: { fontFamily: joyful.style.fontFamily, fontStyle: "normal", fontWeight: 500 },
  AFFECTIONATE_CONNECTED: { fontFamily: warm.style.fontFamily, fontStyle: "normal", fontWeight: 400 },
  CALM_PEACEFUL: { fontFamily: calm.style.fontFamily, fontStyle: "normal", fontWeight: 300 },
};

/**
 * Optical size correction: the same font-size looks very different across
 * these faces (a script runs small, a heavy grotesque runs wide), so each is
 * scaled to sit at a similar visual size beside the others.
 */
export const MOOD_TYPE_SCALE: Record<Emotion, number> = {
  LOW_SAD: 1.12,
  ANXIOUS_WORRIED: 0.86,
  ANGRY_FRUSTRATED: 0.72,
  STRESSED_OVERWHELMED: 0.7,
  NUMB_DISCONNECTED: 0.74,
  POSITIVE_JOYFUL: 0.9,
  AFFECTIONATE_CONNECTED: 1.28,
  CALM_PEACEFUL: 0.84,
};
