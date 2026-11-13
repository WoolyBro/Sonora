import { ArrowRight, AudioLines, Feather, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import { FeaturedCollections } from "@/components/landing/FeaturedCollections";
import { MoodOrbit } from "@/components/landing/MoodOrbit";
import { WaveField } from "@/components/landing/WaveField";
import { Reveal, SplitWords, Stagger, StaggerItem } from "@/components/motion/Reveal";
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
        <MoodOrbit className="pointer-events-auto absolute right-[-3%] top-1/2 -z-10 hidden aspect-square w-[min(40vw,580px)] -translate-y-[46%] lg:block xl:right-[4%]" />
        <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-[1400px] flex-col justify-center px-4 pb-24 pt-10 sm:px-6 md:min-h-[78dvh]">
          <Reveal y={10} as="header" className="mb-6">
            <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted">Feel · Write · Listen</p>
          </Reveal>
          <h1 className="font-display max-w-4xl text-[clamp(2.75rem,8vw,6.5rem)] leading-[0.98]">
            <SplitWords text="Your emotions have a" delay={0.1} />{" "}
            <em className="[font-variation-settings:'SOFT'_100]">
              <SplitWords text="soundtrack." delay={0.45} wordClassName="text-sheen" />
            </em>
          </h1>
          <Reveal delay={0.75} y={16}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">
              Tell us what&rsquo;s on your mind. Discover music that meets you where you are.
            </p>
          </Reveal>
          <Reveal delay={0.95} y={16} className="mt-10 flex flex-wrap gap-3">
            <Link href="/experience" className={`${btn.primary} px-6 py-3 text-base`}>
              Discover your sound <ArrowRight size={18} />
            </Link>
            <Link href="/discover" className={`${btn.secondary} px-6 py-3 text-base`}>
              Explore music
            </Link>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section aria-labelledby="how" className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="grid gap-12 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
          <Reveal>
            <h2 id="how" className="font-display text-4xl leading-tight sm:text-5xl">From a feeling to a sound in three steps.</h2>
            <p className="mt-5 max-w-md text-muted">
              Sonora reads the emotional texture of what you write across eight states, then matches it against the mood, energy and
              feel of every track in the library.
            </p>
            <Stagger as="ul" stagger={0.05} className="mt-8 flex flex-wrap gap-2">
              {EMOTIONS.map((e) => (
                <StaggerItem
                  as="li"
                  key={e}
                  className="rounded-full px-3 py-1 text-xs ring-1 ring-hairline transition-transform duration-300 hover:-translate-y-0.5"
                  style={{ color: EMOTION_INFO[e].accent, background: `${EMOTION_INFO[e].palette[0]}55` }}
                >
                  {EMOTION_INFO[e].label}
                </StaggerItem>
              ))}
            </Stagger>
          </Reveal>
          <Stagger as="ol" stagger={0.12} className="grid gap-4 sm:grid-cols-3 md:gap-5">
            {STEPS.map((s, i) => (
              <StaggerItem
                as="li"
                key={s.title}
                className="group relative overflow-hidden rounded-3xl bg-surface p-6 ring-1 ring-hairline transition duration-500 hover:-translate-y-1 hover:bg-surface-strong hover:ring-white/15"
              >
                <span
                  aria-hidden="true"
                  className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[var(--atmo-accent)] opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-25"
                />
                <div className="relative flex items-center justify-between">
                  <s.icon size={22} className="text-[var(--atmo-accent)] transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110" />
                  <span className="font-display text-3xl text-white/15 transition-colors duration-500 group-hover:text-white/30">0{i + 1}</span>
                </div>
                <h3 className="relative mt-10 text-lg font-semibold">{s.title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Featured collections */}
      <section aria-labelledby="collections" className="mx-auto mt-28 max-w-[1400px] px-4 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <Reveal>
            <h2 id="collections" className="font-display text-4xl sm:text-5xl">Rooms to step into</h2>
            <p className="mt-3 text-muted">Collections shaped around a feeling, not a genre.</p>
          </Reveal>
          <Link href="/discover" className={`${btn.ghost} hidden sm:inline-flex`}>
            All collections <ArrowRight size={16} />
          </Link>
        </div>
        <FeaturedCollections ids={featured.map((c) => c.id)} />
      </section>

      {/* Care + CTA */}
      <Reveal as="section" className="mx-auto mt-28 max-w-[1400px] px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-surface px-6 py-14 ring-1 ring-hairline sm:px-12 md:py-20">
          <div aria-hidden="true" className="absolute -right-24 -top-24 h-80 w-80 animate-[drift-a_18s_ease-in-out_infinite] rounded-full bg-[var(--atmo-accent)] opacity-20 blur-3xl" />
          <div aria-hidden="true" className="absolute -bottom-32 left-1/4 h-72 w-72 animate-[drift-b_24s_ease-in-out_infinite] rounded-full bg-[var(--warm)] opacity-10 blur-3xl" />
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
      </Reveal>
    </>
  );
}
