import { ArrowRight, AudioLines, Feather, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import { FeaturedCollections } from "@/components/landing/FeaturedCollections";
import { WaveField } from "@/components/landing/WaveField";
import { btn } from "@/components/ui/styles";
import { catalog } from "@/lib/catalog";
import { EMOTIONS, EMOTION_INFO } from "@/lib/emotion/taxonomy";

const STEPS = [
  {
    icon: Feather,
    title: "Say it your way",
    body: "Write how you feel in your own words. A sentence is plenty. There's no wrong way to put it.",
  },
  {
    icon: SlidersHorizontal,
    title: "See how it reads",
    body: "Sonora estimates the feelings in your words and how strongly they come through. Adjust anything that's off.",
  },
  {
    icon: AudioLines,
    title: "Choose a direction",
    body: "Music that meets your mood, gently shifts it, or takes you somewhere new. You decide where to go.",
  },
];

export default function Home() {
  const featured = catalog.collections.slice(0, 4);
  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <WaveField className="absolute inset-x-0 top-[8%] -z-10 h-[78%] w-full opacity-90" />
        <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-[1400px] flex-col justify-center px-4 pb-24 pt-10 sm:px-6 md:min-h-[78dvh]">
          <p className="mb-6 text-xs font-medium uppercase tracking-[0.28em] text-muted">Feel · Write · Listen</p>
          <h1 className="font-display max-w-4xl text-[clamp(2.75rem,8vw,6.5rem)] leading-[0.98]">
            Your emotions have a <em className="text-[var(--atmo-accent)] [font-variation-settings:'SOFT'_100]">soundtrack.</em>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">
            Tell us what&rsquo;s on your mind. Discover music that meets you where you are.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/experience" className={`${btn.primary} px-6 py-3 text-base`}>
              Discover your sound <ArrowRight size={18} />
            </Link>
            <Link href="/discover" className={`${btn.secondary} px-6 py-3 text-base`}>
              Explore music
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how" className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="grid gap-12 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
          <div>
            <h2 id="how" className="font-display text-4xl leading-tight sm:text-5xl">From a feeling to a sound in three steps.</h2>
            <p className="mt-5 max-w-md text-muted">
              Sonora reads the emotional texture of what you write across eight states, then matches it against the mood, energy and
              feel of every track in the library.
            </p>
            <ul className="mt-8 flex flex-wrap gap-2" aria-label="The eight emotional states">
              {EMOTIONS.map((e) => (
                <li
                  key={e}
                  className="rounded-full px-3 py-1 text-xs ring-1 ring-hairline"
                  style={{ color: EMOTION_INFO[e].accent, background: `${EMOTION_INFO[e].palette[0]}55` }}
                >
                  {EMOTION_INFO[e].label}
                </li>
              ))}
            </ul>
          </div>
          <ol className="grid gap-4 sm:grid-cols-3 md:gap-5">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-3xl bg-surface p-6 ring-1 ring-hairline">
                <div className="flex items-center justify-between">
                  <s.icon size={22} className="text-[var(--atmo-accent)]" />
                  <span className="font-display text-3xl text-white/15">0{i + 1}</span>
                </div>
                <h3 className="mt-10 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Featured collections */}
      <section aria-labelledby="collections" className="mx-auto mt-28 max-w-[1400px] px-4 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 id="collections" className="font-display text-4xl sm:text-5xl">Rooms to step into</h2>
            <p className="mt-3 text-muted">Collections shaped around a feeling, not a genre.</p>
          </div>
          <Link href="/discover" className={`${btn.ghost} hidden sm:inline-flex`}>
            All collections <ArrowRight size={16} />
          </Link>
        </div>
        <FeaturedCollections ids={featured.map((c) => c.id)} />
      </section>

      {/* Care + CTA */}
      <section className="mx-auto mt-28 max-w-[1400px] px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-surface px-6 py-14 ring-1 ring-hairline sm:px-12 md:py-20">
          <div aria-hidden="true" className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[var(--atmo-accent)] opacity-20 blur-3xl" />
          <div className="relative grid gap-10 md:grid-cols-[1.3fr_1fr] md:items-end">
            <div>
              <h2 className="font-display text-4xl leading-tight sm:text-5xl">However today feels, there&rsquo;s a sound for it.</h2>
              <p className="mt-5 max-w-lg text-muted">
                Sonora is for listening, not diagnosing. It never stores what you write unless you ask it to, and it&rsquo;s not a
                substitute for support from people or professionals.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <Link href="/experience" className={`${btn.primary} px-6 py-3 text-base`}>
                Check in now <ArrowRight size={18} />
              </Link>
              <Link href="/privacy" className={`${btn.ghost} px-4 py-3`}>
                How your words are handled
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
