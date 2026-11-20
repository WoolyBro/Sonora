import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Caveat, Imbue, Instrument_Serif, Wavefont } from "next/font/google";

import { Footer } from "@/components/layout/Footer";
import { Providers } from "@/components/layout/Providers";
import { MobileNav, SiteHeader } from "@/components/layout/SiteHeader";

import "./globals.css";

// Headlines: a tall, condensed, high-contrast Didone. Variable weight, so the
// cursor weight wave (motion/Kinetic.tsx) still works.
const display = Imbue({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
  display: "swap",
});

// The italic accent word in headlines ("soundtrack."), and one roman section heading.
const accent = Instrument_Serif({
  variable: "--font-accent",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

// Body and UI: a characterful variable grotesque.
const body = Bricolage_Grotesque({
  variable: "--font-body",
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
  display: "swap",
});

// Each character is an audio bar: text drawn as a waveform (decorative only).
const wave = Wavefont({
  variable: "--font-wave",
  axes: ["ROND", "YELA"],
  display: "swap",
});

// Hand-written notes next to the doodles.
const hand = Caveat({
  variable: "--font-hand",
  subsets: ["latin"],
  weight: ["500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Sonora: your emotions have a soundtrack", template: "%s · Sonora" },
  description: "Tell Sonora how you feel in your own words and discover music that meets you where you are.",
  icons: { icon: "/icon.svg" },
  openGraph: {
    title: "Sonora",
    description: "Feel something. Put it into words. Let Sonora find your sound.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f2ea",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${accent.variable} ${body.variable} ${wave.variable} ${hand.variable} antialiased`}>
      <body className="grain min-h-dvh">
        <Providers>
          <div className="relative z-10 flex min-h-dvh flex-col">
            <SiteHeader />
            <main id="main" className="page-pad flex-1">
              {children}
            </main>
            <Footer />
          </div>
          <MobileNav />
        </Providers>
      </body>
    </html>
  );
}
