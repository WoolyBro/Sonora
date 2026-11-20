import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// next/font is a build-time transform that doesn't exist under Vitest, so each
// font loader returns a stub with the same shape. Add new fonts here.
vi.mock("next/font/google", () => {
  const loader = () => ({ className: "font-stub", variable: "--font-stub", style: { fontFamily: "stub" } });
  const fonts = [
    // layout.tsx
    "Bricolage_Grotesque", "Caveat", "Imbue", "Instrument_Serif", "Wavefont",
    // components/motion/moodType.ts
    "Climate_Crisis", "Comfortaa", "Cormorant_Garamond", "Dela_Gothic_One", "Gluten", "Ms_Madi", "Shantell_Sans", "Space_Mono",
  ];
  return Object.fromEntries(fonts.map((name) => [name, loader]));
});
