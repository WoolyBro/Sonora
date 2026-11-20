import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { FeaturedCollections } from "@/components/landing/FeaturedCollections";
import { MoodOrbit } from "@/components/landing/MoodOrbit";
import { WaveField } from "@/components/landing/WaveField";
import { FeelingsTicker, MoodReel, ProximityGroup, ProxWords, WaveText } from "@/components/motion/Kinetic";
import { Reveal, SplitWords, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { Doodle, HandNote, type DoodleName } from "@/components/ui/Doodle";
import { btn } from "@/components/ui/styles";
import { catalog } from "@/lib/catalog";

const STEPS: { doodle: DoodleName; colour: string; title: string; body: string }[] = [
  {
    doodle: "pencil",
    colour: "text-[var(--atmo-ink)]",
    title: "Say it your way",
    body: "Write how you feel in your own words. A sentence is plenty. There's no wrong way to put it.",
  },
  {
    doodle: "eye",
    colour: "text-[#c25a3a]",
    title: "See how it reads",
    body: "Sonora estimates the feelings in your words and how strongly they come through. Adjust anything that's off.",
  },
  {
    doodle: "headphones",
    colour: "text-[#2f7a6b]",
    title: "Choose a direction",
    body: "Music that meets your mood, gently shifts it, or takes you somewhere new. You decide where to go.",
  },
];

export default function Home() {
  const featured = catalog.collections.slice(0, 4);
  return (
    <>
      {/* Hero */}
      <section data-landing="" className="relative isolate overflow-hidden">
        <WaveField className="absolute inset-x-0 top-[8%] -z-10 h-[78%] w-full opacity-90" />
        <MoodOrbit className="pointer-events-auto absolute right-[-3%] top-1/2 -z-10 hidden aspect-square w-[min(40vw,580px)] -translate-y-[46%] lg:block xl:right-[4%]" />
        <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-[1400px] flex-col justify-center px-4 pb-24 pt-10 sm:px-6 md:min-h-[78dvh]">
          <Reveal y={10} as="header" className="mb-6">
            <p className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.28em] text-muted">
              <WaveText length={18} seed={2} className="text-[22px] text-[var(--atmo-ink)]" />
              Feel · Write · Listen
            </p>
          </Reveal>
          <ProximityGroup as="h1" className="font-display relative max-w-4xl text-[clamp(3.6rem,11vw,9.5rem)] leading-[0.9]">
            <SplitWords text="Your emotions have a" delay={0.1} letters />{" "}
            <em className="font-accent relative inline-block pr-[0.06em]">
              <SplitWords text="soundtrack." delay={0.45} wordClassName="text-sheen" letters />
              {/* scribbled underline, drawn after the word lands */}
              <Doodle name="underline" delay={1.1} strokeWidth={3} className="absolute -bottom-[0.18em] left-0 h-[0.3em] w-full text-[var(--warm)]" />
            </em>
            <Doodle name="sparkle" delay={1.4} float tilt={-8} className="absolute -top-6 left-[min(58vw,640px)] hidden h-10 w-10 text-[var(--warm)] sm:block" />
            <Doodle name="star" delay={1.6} float tilt={12} className="absolute -top-1 left-[min(64vw,700px)] hidden h-5 w-5 text-[var(--atmo-ink)] sm:block" />
          </ProximityGroup>
          <Reveal delay={0.75} y={16}>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">
              Tell us what&rsquo;s on your mind. Discover music that meets you where you are.
            </p>
          </Reveal>
          <Reveal delay={0.95} y={16} className="relative mt-10 flex flex-wrap gap-3">
            <Link href="/experience" className={`${btn.primary} px-6 py-3 text-base`}>
              Discover your sound <ArrowRight size={18} />
            </Link>
            <Link href="/discover" className={`${btn.secondary} px-6 py-3 text-base`}>
              Explore music
            </Link>
            {/* margin note: "one sentence is enough", with an arrow up to the button */}
            <span className="pointer-events-none absolute left-6 top-full mt-3 hidden items-start gap-1 sm:flex">
              <Doodle name="arrow" delay={1.5} className="h-12 w-16 -scale-y-100 text-[var(--atmo-ink)]" />
              <HandNote className="mt-7 text-2xl">one sentence is enough</HandNote>
            </span>
          </Reveal>
        </div>
      </section>

      {/* Feeling words drifting on a wave */}
      <Reveal y={0} className="-mt-10 mb-16 sm:-mt-6 sm:mb-24">
        <FeelingsTicker />
      </Reveal>

      {/* How it works */}
      <section aria-labelledby="how" className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="grid gap-12 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
          <Reveal>
            <ProximityGroup as="h2" id="how" className="font-display relative text-5xl leading-[1.02] sm:text-6xl">
              <ProxWords text="From a feeling to a sound in" />{" "}
              <span className="relative inline-block">
                <ProxWords text="three" />
                <Doodle name="loop" delay={0.4} strokeWidth={2.6} className="absolute -bottom-4 left-1/2 h-6 w-[130%] -translate-x-1/2 text-[var(--warm)]" />
              </span>{" "}
              <ProxWords text="steps." />
            </ProximityGroup>
            <p className="mt-5 max-w-md text-muted">
              Sonora reads the emotional texture of what you write across eight states, then matches it against the mood, energy and
              feel of every track in the library.
            </p>
            <MoodReel className="mt-8" />
          </Reveal>
          <Stagger as="ol" stagger={0.12} className="grid gap-4 self-start sm:grid-cols-3 md:gap-5">
            {STEPS.map((s, i) => (
              <StaggerItem
                as="li"
                key={s.title}
                className="group relative overflow-hidden rounded-3xl bg-surface p-6 ring-1 ring-hairline transition duration-500 hover:-translate-y-1 hover:bg-surface-strong hover:ring-ink/15"
              >
                <span
                  aria-hidden="true"
                  className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[var(--atmo-accent)] opacity-0 blur-3xl transition-opacity duration-700 group-hover:opacity-25"
                />
                <div className="relative flex items-center justify-between">
                  <Doodle name={s.doodle} delay={0.3 + i * 0.25} className={`doodle-on-group h-11 w-11 ${s.colour}`} />
                  <span className="font-display text-3xl text-ink/15 transition-colors duration-500 group-hover:text-ink/30">0{i + 1}</span>
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
            <ProximityGroup as="h2" id="collections" className="font-display flex items-center gap-3 text-5xl sm:text-6xl">
              <span>
                <ProxWords text="Rooms to step into" />
              </span>
              <Doodle name="swirl" delay={0.3} tilt={10} className="h-10 w-10 text-[#2f7a6b]" />
            </ProximityGroup>
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
          <WaveText length={260} seed={5} className="pointer-events-none absolute inset-x-0 bottom-3 overflow-hidden px-6 text-[44px] text-[var(--atmo-ink)] opacity-[0.14] sm:px-12" />
          <Doodle name="heart" delay={0.4} float tilt={-12} className="absolute right-8 top-8 hidden h-12 w-12 text-[#c2416a] md:block" />
          <Doodle name="smile" delay={0.7} float tilt={8} className="absolute bottom-8 right-[38%] hidden h-10 w-10 text-[var(--atmo-ink)] md:block" />
          <Doodle name="notes" delay={1} float tilt={-6} className="absolute left-[46%] top-10 hidden h-9 w-9 text-[var(--warm)] lg:block" />
          <div className="relative grid gap-10 md:grid-cols-[1.3fr_1fr] md:items-end">
            <div>
              <ProximityGroup as="h2" className="font-display text-5xl leading-[1.02] sm:text-6xl">
                <ProxWords text="However today feels, there’s a sound for it." />
              </ProximityGroup>
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
