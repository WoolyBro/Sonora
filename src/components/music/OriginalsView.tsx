"use client";

import { Pause, Play, Sparkles } from "lucide-react";

import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { usePlayer } from "@/components/player/PlayerProvider";
import { Doodle } from "@/components/ui/Doodle";
import { btn, cn } from "@/components/ui/styles";
import { catalog } from "@/lib/catalog";
import { formatTime } from "@/lib/audio/format";
import { EMOTION_INFO } from "@/lib/emotion/taxonomy";

import { Cover } from "./Cover";
import { FavouriteButton } from "./FavouriteButton";
import { Equaliser, SampleBadge } from "./TrackItems";
import { TrackMenu } from "./TrackMenu";

export function OriginalsView() {
  const player = usePlayer();
  const originals = catalog.tracks.filter((t) => t.isOriginal);
  const allSamples = originals.every((t) => t.isSample);

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-6 sm:px-6 md:pt-12">
      <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-end">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted">Sonora Originals</p>
          <h1 className="font-display relative mt-4 text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.02]">
            Made here, for the moods in between.
            <Doodle name="notes" delay={0.5} float tilt={-10} className="absolute -top-8 right-4 hidden h-10 w-10 text-[var(--atmo-ink)] sm:block" />
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Original music created or commissioned for Sonora, including AI-assisted compositions and vocals, always credited as such.
          </p>
        </div>
        {originals.length > 0 && (
          <div className="flex md:justify-end">
            <button type="button" className={`${btn.primary} px-6 py-3`} onClick={() => player.playTracks(originals, 0, "Sonora Originals")}>
              <Play size={16} fill="currentColor" /> Play all originals
            </button>
          </div>
        )}
      </div>

      {allSamples && (
        <p className="mt-10 flex gap-3 rounded-2xl bg-ink/[0.04] p-4 text-sm text-muted ring-1 ring-hairline">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-[var(--atmo-ink)]" />
          <span>
            These are generated sample sketches, there so every feature works end to end. They&rsquo;re not finished songs and Sonora
            doesn&rsquo;t generate music on request. Add your own originals in <code className="text-ink">src/data/catalog.json</code> with{" "}
            <code className="text-ink">&quot;isOriginal&quot;: true</code>.
          </span>
        </p>
      )}

      {originals.length === 0 ? (
        <p className="mt-12 text-muted">No originals in the catalogue yet.</p>
      ) : (
        <Stagger as="ul" stagger={0.08} className="mt-12 grid gap-5 md:grid-cols-2">
          {originals.map((t, i) => {
            const isCurrent = player.track?.id === t.id;
            const playing = isCurrent && player.status === "playing";
            return (
              <StaggerItem as="li" key={t.id} className={cn("group grid grid-cols-[7rem_1fr] gap-5 rounded-[1.75rem] bg-surface p-4 ring-1 ring-hairline transition duration-500 hover:bg-surface-strong sm:grid-cols-[9rem_1fr]", isCurrent && "halo")}>
                <button
                  type="button"
                  onClick={() => (isCurrent ? player.toggle() : player.playTracks(originals, i, "Sonora Originals"))}
                  className="relative self-start"
                  aria-label={playing ? `Pause ${t.title}` : `Play ${t.title}`}
                >
                  <Cover seed={t.id} mood={t.primaryMood} artwork={t.artwork} rounded="rounded-2xl" />
                  <span className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-ink text-bg shadow-lg">
                    {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
                  </span>
                </button>
                <div className="min-w-0 py-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-2 truncate text-lg font-semibold">
                        {isCurrent && <Equaliser paused={!playing} className="text-[var(--atmo-ink)]" />}
                        <span className="truncate">{t.title}</span>
                      </h2>
                      <p className="truncate text-sm text-muted">
                        {t.artist} · {formatTime(t.duration)}
                      </p>
                    </div>
                    <div className="-mr-2 -mt-1 flex">
                      <FavouriteButton trackId={t.id} title={t.title} />
                      <TrackMenu track={t} />
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-ink/80">{t.description}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full px-2.5 py-1" style={{ color: EMOTION_INFO[t.primaryMood].palette[0], background: `${EMOTION_INFO[t.primaryMood].accent}38` }}>
                      {EMOTION_INFO[t.primaryMood].label}
                    </span>
                    {t.secondaryMoods.map((m) => (
                      <span key={m} className="rounded-full bg-ink/[0.04] px-2.5 py-1 text-muted">
                        {EMOTION_INFO[m].short}
                      </span>
                    ))}
                    {t.aiAssisted && <span className="rounded-full bg-ink/[0.04] px-2.5 py-1 text-muted">AI-assisted</span>}
                    {t.isSample && <SampleBadge />}
                  </div>
                  <p className="mt-3 text-xs text-faint">{t.credits}</p>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}
