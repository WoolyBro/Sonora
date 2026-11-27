import { ArrowUpRight, Asterisk, LockKeyhole, Orbit } from "lucide-react";
import Link from "next/link";

import { AppPreview } from "@/components/landing/AppPreview";
import { RoomsStamp } from "@/components/landing/RoomsStamp";
import { FeelingsTicker, ProximityGroup, ProxWords } from "@/components/motion/Kinetic";
import { Reveal, SplitWords, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { Cover } from "@/components/music/Cover";
import { catalog, collectionTracks } from "@/lib/catalog";

const STEPS = [
  { title: "Write", body: "Say how you feel in your own words. A sentence is plenty." },
  { title: "Read", body: "Sonora’s own model reads eight feelings, and how strongly each comes through, on your device." },
  { title: "Match", body: "Every track is tagged by mood, energy and feel, so the match is about texture, not genre." },
  { title: "Listen", body: "Stay with the feeling, ease it gently, or go somewhere new. You choose the direction." },
];

const PRINCIPLES = [
  {
    icon: LockKeyhole,
    title: "Your words stay yours",
    body: "Read by Sonora’s own model inside your browser. What you write is never sent to a server or stored.",
  },
  {
    icon: Orbit,
    title: "Eight feelings, not two",
    body: "Low, anxious, angry, stressed, numb, joyful, warm and calm, with how strongly each one comes through.",
  },
  {
    icon: ArrowUpRight,
    title: "Meet it, or move it",
    body: "Music that matches where you are, or eases you somewhere gentler. Never a diagnosis, just a soundtrack.",
  },
];

/** Two-line editorial headline: a serif line over a tight grotesque line. */
function Headline({ id, serif, bold, className = "" }: { id?: string; serif: string; bold: string; className?: string }) {
  return (
    <ProximityGroup as="h2" id={id} className={`text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] ${className}`}>
      <span className="font-serif block font-normal tracking-[-0.02em]">
        <ProxWords text={serif} />
      </span>
      <span className="font-headline block">
        <ProxWords text={bold} />
      </span>
    </ProximityGroup>
  );
}

export default function Home() {
  const rooms = catalog.collections.slice(0, 4);
  return (
    <>
      {/* Hero: sky gradient that runs up behind the header */}
      <section data-landing="" className="sky relative -mt-16 overflow-hidden pt-16 md:-mt-[72px] md:pt-[72px]">
        <div className="mx-auto max-w-[1400px] px-4 pt-14 text-center sm:px-6 sm:pt-20">
          <ProximityGroup as="h1" className="mx-auto max-w-5xl text-[clamp(2.9rem,8.4vw,6.6rem)] leading-[0.98]">
            <span className="font-serif block font-normal tracking-[-0.025em]">
              <SplitWords text="Your feelings," delay={0.05} letters />
            </span>
            <span className="font-headline block">
              <SplitWords text="have a soundtrack" delay={0.3} letters />
            </span>
          </ProximityGroup>
          <Reveal delay={0.6} y={12}>
            <p className="font-serif mx-auto mt-6 max-w-2xl text-lg leading-snug text-ink/85 sm:text-[1.4rem]">
              Tell Sonora how you feel in your own words. It finds music that meets you where you are.
            </p>
          </Reveal>
          <Reveal delay={0.75} y={12} className="mt-9 flex flex-wrap justify-center gap-3 sm:gap-4">
            <Link href="/experience" className="btn-mono">
              Discover your sound
            </Link>
            <Link href="/discover" className="btn-mono">
              Explore music
            </Link>
          </Reveal>
          <Reveal delay={0.9} y={40} className="mx-auto mt-14 max-w-[820px] text-left sm:mt-16">
            <AppPreview />
          </Reveal>
        </div>
      </section>

      {/* Feeling words drifting on a wave */}
      <Reveal y={0} className="my-14 sm:my-20">
        <FeelingsTicker />
      </Reveal>

      {/* How it works */}
      <section aria-labelledby="how" className="mx-auto max-w-[1180px] px-4 sm:px-6">
        <Reveal className="text-center">
          <ProximityGroup as="h2" id="how" className="font-headline mx-auto max-w-2xl text-[clamp(1.9rem,3.6vw,2.6rem)] leading-[1.08]">
            <ProxWords text="Everything you need to hear how you feel" />
          </ProximityGroup>
        </Reveal>

        <Reveal y={24} className="relative mt-10 overflow-hidden sm:mt-12">
          <div className="relative h-[360px] sm:h-[460px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- local artwork */}
            <img src="/artwork/mine-lightness-returns.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,#a9d2ff,#fbe3c4)] opacity-80 mix-blend-multiply" />
            <div className="absolute inset-0 bg-white/15" />
            <div className="absolute left-1/2 top-1/2 w-[min(86%,640px)] -translate-x-1/2 -translate-y-1/2 bg-white p-4 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.4)] sm:p-5">
              <div className="flex items-start justify-between">
                <p className="font-mono text-sm sm:text-base">Feelings Sonora can read</p>
                <Asterisk size={44} strokeWidth={1} aria-hidden="true" className="-mr-1 -mt-1" />
              </div>
              <div className="mt-10 flex items-end justify-between sm:mt-16">
                <p className="font-headline text-6xl leading-none sm:text-7xl">
                  8 <span className="font-mono text-base font-normal tracking-normal text-ink/50">moods</span>
                </p>
                <p className="font-mono text-sm text-[#1f6fd6] sm:text-base">on your device</p>
              </div>
            </div>
          </div>
        </Reveal>

        <Stagger as="ol" stagger={0.08} className="mt-4">
          {STEPS.map((s, i) => (
            <StaggerItem as="li" key={s.title} className="group border-b border-ink/12 py-5">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-lg font-semibold transition-transform duration-500 group-hover:translate-x-1">{s.title}</h3>
                <span className="font-mono text-xs text-ink/45">00{i + 1}</span>
              </div>
              <p className="font-serif mt-1.5 text-lg text-ink/80">{s.body}</p>
            </StaggerItem>
          ))}
        </Stagger>
        <Link href="/experience" className="btn-mono mt-6 w-full">
          Check in now
        </Link>
      </section>

      {/* Principles on warm paper */}
      <section aria-labelledby="principles" className="paper-texture mt-24 py-20 sm:mt-28 sm:py-28">
        <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
          <Reveal className="text-center">
            <Headline id="principles" serif="Built for feeling" bold="Designed for listening" />
          </Reveal>
          <Stagger stagger={0.1} className="mt-12 grid gap-4 md:grid-cols-3">
            {PRINCIPLES.map((p) => (
              <StaggerItem key={p.title} className="group rounded-2xl bg-white p-6 transition duration-500 hover:-translate-y-1 sm:p-8">
                <p.icon size={36} strokeWidth={1.2} aria-hidden="true" className="transition-transform duration-500 group-hover:rotate-12" />
                <h3 className="mt-14 text-lg font-semibold">{p.title}</h3>
                <p className="font-serif mt-1.5 text-[17px] leading-snug text-ink/80">{p.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Originals feature */}
      <section aria-labelledby="originals" className="mx-auto mt-24 max-w-[1180px] px-4 sm:mt-28 sm:px-6">
        <Reveal className="grid items-center gap-8 rounded-3xl bg-[#f4f6fa] p-4 sm:p-6 md:grid-cols-2 md:gap-12">
          <div className="halftone aspect-[4/3] rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element -- local artwork */}
            <img src="/artwork/mine-morning-light.jpg" alt="" loading="lazy" />
          </div>
          <div className="pb-4 md:pb-0 md:pr-6">
            <h2 id="originals" className="text-xl font-semibold">
              Why Sonora makes its own music
            </h2>
            <p className="font-serif mt-3 text-lg leading-snug text-ink/85">
              Sonora Originals are written for a feeling first. Each track is filed by mood and by intensity, so
              &ldquo;a little low&rdquo; and &ldquo;really low&rdquo; lead to different songs.
            </p>
            <Link href="/originals" className="btn-mono mt-6">
              Listen to Originals
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Rooms (collections) as a journal list */}
      <section aria-labelledby="rooms" className="mx-auto mt-24 max-w-[1400px] px-4 sm:mt-28 sm:px-6">
        <div className="flex flex-col items-center gap-6 md:flex-row md:justify-center md:gap-10">
          <RoomsStamp className="w-56 shrink-0 md:w-64" />
          <Reveal>
            <ProximityGroup as="h2" id="rooms" className="font-headline text-[clamp(2rem,4vw,2.8rem)]">
              <ProxWords text="Rooms to step into" />
            </ProximityGroup>
            <p className="font-serif text-lg text-ink/70">Collections shaped around a feeling, not a genre.</p>
          </Reveal>
        </div>
        <Stagger as="ul" stagger={0.08} className="mx-auto mt-10 max-w-3xl border-t border-ink/12">
          {rooms.map((c) => (
            <StaggerItem as="li" key={c.id} className="border-b border-ink/12">
              <Link href={`/collections/${c.id}`} className="group flex items-center gap-4 py-4 sm:gap-6">
                <div className="w-28 shrink-0 overflow-hidden sm:w-44">
                  <Cover
                    seed={c.id}
                    palette={c.palette}
                    rounded="rounded-none"
                    className="!aspect-[16/10] transition duration-700 ease-[var(--ease-soft)] group-hover:scale-105"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold leading-tight group-hover:underline group-hover:underline-offset-4 sm:text-xl">
                    {c.title}
                  </h3>
                  <p className="mt-1 font-mono text-xs text-ink/55">
                    {collectionTracks(c).length} tracks · {c.description.split(/[.,]/)[0].toLowerCase()}
                  </p>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
        <div className="mt-8 text-center">
          <Link href="/discover" className="btn-mono">
            All collections
          </Link>
        </div>
      </section>

      {/* An example check-in */}
      <section aria-labelledby="example" className="mx-auto mt-24 max-w-[1180px] px-4 sm:mt-28 sm:px-6">
        <Reveal className="grid items-center gap-8 md:grid-cols-2 md:gap-14">
          <div className="halftone aspect-square [--ht-ink:#2f80ed]">
            {/* eslint-disable-next-line @next/next/no-img-element -- local artwork */}
            <img src="/artwork/mine-song-e84fcc.jpg" alt="" loading="lazy" />
          </div>
          <figure>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-ink/55">Example check-in</p>
            <span aria-hidden="true" className="font-serif mt-6 block text-6xl leading-none text-ink/25">
              &ldquo;
            </span>
            <blockquote id="example" className="font-headline text-[clamp(1.7rem,3.2vw,2.5rem)] leading-[1.12]">
              I&rsquo;ve had a stressful day and I can&rsquo;t seem to switch off.
            </blockquote>
            <figcaption className="mt-8 border-t border-ink/12 pt-4">
              <p className="font-semibold">Sonora reads: stressed / overwhelmed</p>
              <p className="font-serif text-lg text-ink/70">and offers music that helps you exhale, or keeps you company in it.</p>
            </figcaption>
          </figure>
        </Reveal>
      </section>

      {/* Closing call to action */}
      <section className="mt-24 bg-[#f4f6fa] py-20 text-center sm:mt-28 sm:py-24">
        <Reveal className="mx-auto max-w-[1400px] px-4 sm:px-6">
          <h2 className="font-headline text-[clamp(1.8rem,3.4vw,2.6rem)] leading-tight">Ready to hear how today feels?</h2>
          <Link href="/experience" className="btn-mono mt-6">
            Check in now
          </Link>
          <p className="font-serif mx-auto mt-6 max-w-md text-ink/65">
            Sonora is for listening, not diagnosing.{" "}
            <Link href="/privacy" className="tap relative underline underline-offset-2 hover:text-ink">
              How your words are handled
            </Link>
          </p>
        </Reveal>
      </section>
    </>
  );
}
