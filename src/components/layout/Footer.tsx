import Link from "next/link";

import { BrandMark } from "./Brand";

export function Footer() {
  return (
    <footer className="relative z-10 mt-24 border-t border-hairline">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-xl">Sonora</span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Feel something. Put it into words. Let Sonora find your sound.
          </p>
          <p className="mt-4 text-xs leading-relaxed text-faint">
            Sonora is a music experience, not a medical or mental-health service. If you&rsquo;re struggling, please reach out to
            someone you trust or find a local helpline at{" "}
            <a className="tap relative underline decoration-ink/30 underline-offset-2 hover:text-ink" href="https://findahelpline.com" target="_blank" rel="noreferrer">
              findahelpline.com
            </a>
            .
          </p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 text-sm md:col-span-2 md:grid-cols-2">
          <ul className="space-y-3">
            <li className="text-xs uppercase tracking-[0.16em] text-faint">Listen</li>
            <li><Link className="tap relative text-muted hover:text-ink" href="/experience">Check in</Link></li>
            <li><Link className="tap relative text-muted hover:text-ink" href="/discover">Discover</Link></li>
            <li><Link className="tap relative text-muted hover:text-ink" href="/originals">Sonora Originals</Link></li>
          </ul>
          <ul className="space-y-3">
            <li className="text-xs uppercase tracking-[0.16em] text-faint">You</li>
            <li><Link className="tap relative text-muted hover:text-ink" href="/profile">Your library</Link></li>
            <li><Link className="tap relative text-muted hover:text-ink" href="/privacy">Privacy &amp; your data</Link></li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
