import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// next/font is a build-time transform that doesn't exist under Vitest, so each
// font loader returns a stub with the same shape. Add new fonts here.
vi.mock("next/font/google", () => {
  const loader = () => ({ className: "font-stub", variable: "--font-stub", style: { fontFamily: "stub" } });
  const fonts = [
    // layout.tsx
    "Bricolage_Grotesque", "Caveat", "Geist_Mono", "Imbue", "Instrument_Serif", "Source_Serif_4", "Wavefont",
    // components/motion/moodType.ts
    "Bodoni_Moda", "Cormorant_Garamond", "Fraunces", "Italiana", "Jost", "Ms_Madi", "Newsreader", "Playfair_Display",
  ];
  return Object.fromEntries(fonts.map((name) => [name, loader]));
});
