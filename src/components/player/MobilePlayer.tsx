"use client";

import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { OrbitText } from "@/components/motion/Kinetic";
import { Cover } from "@/components/music/Cover";
import { FavouriteButton } from "@/components/music/FavouriteButton";
import { cn } from "@/components/ui/styles";
import { useReducedMotion } from "@/hooks/useMedia";
import { EMOTION_INFO } from "@/lib/emotion/taxonomy";

import { PlayButton, TimeLabel, TransportControls } from "./Controls";
import { NowPlayingMeta } from "./PlayerBar";
import { usePlayer, usePlayerTime } from "./PlayerProvider";
import { SpectrumAura, SpectrumStrip } from "./Visualizer";
import { QueueList } from "./QueuePanel";
import { WaveSeek } from "./WaveSeek";

function MiniProgress() {
  const { currentTime, duration } = usePlayerTime();
  const { track } = usePlayer();
  const total = duration ?? track?.duration ?? 0;
  return (
    <div className="absolute inset-x-3 bottom-0 h-[2px] overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
      <div className="h-full bg-[var(--atmo-accent)]" style={{ width: `${total ? (currentTime / total) * 100 : 0}%` }} />
    </div>
  );
}

function FullPlayer() {
  const p = usePlayer();
  const reduced = useReducedMotion();
  const drag = useDragControls();
  const [tab, setTab] = useState<"now" | "queue">("now");
  const closeRef = useRef<HTMLButtonElement>(null);
  const track = p.track;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && p.setExpanded(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [p]);

  if (!track) return null;
  const playing = p.status === "playing";

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Now playing"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", stiffness: 320, damping: 36 }}
      drag="y"
      dragControls={drag}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.6 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 120 || info.velocity.y > 600) p.setExpanded(false);
      }}
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-bg"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-80">
        <div className="atmo-blob atmo-blob--1" />
        <div className="atmo-blob atmo-blob--2" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg/40 to-bg" />
      </div>

      <div className="relative flex items-center justify-between px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]" onPointerDown={(e) => drag.start(e)} style={{ touchAction: "none" }}>
        <button ref={closeRef} type="button" onClick={() => p.setExpanded(false)} aria-label="Close full player" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-ink/8">
          <ChevronDown size={24} />
        </button>
        <div className="mx-auto h-1 w-10 rounded-full bg-ink/25" aria-hidden="true" />
        <div className="flex rounded-full bg-ink/6 p-0.5 text-xs" role="tablist" aria-label="Player view">
          {(["now", "queue"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn("rounded-full px-3 py-1.5 transition", tab === t ? "bg-ink/12 text-ink" : "text-muted")}
            >
              {t === "now" ? "Playing" : "Queue"}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col overflow-y-auto px-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        {tab === "now" ? (
          <div className="flex flex-1 flex-col justify-center gap-7 py-4">
            <motion.div
              className="mx-auto mb-7 mt-4 w-full max-w-[20rem]"
              animate={reduced ? undefined : { scale: playing ? 1 : 0.94 }}
              transition={{ type: "spring", stiffness: 200, damping: 24 }}
            >
              {/* Light ripples around the cover with the track's real spectrum. */}
              <SpectrumAura>
                <div className="relative rounded-[28px] shadow-2xl shadow-[rgb(42_32_78/0.16)]">
                  <Cover seed={track.id} mood={track.primaryMood} artwork={track.artwork} rounded="rounded-[28px]" label={`${track.title} cover`} />
                  {/* A record-label sticker that turns while the track plays. */}
                  <OrbitText
                    text={`now playing · ${EMOTION_INFO[track.primaryMood].short} · now playing · ${EMOTION_INFO[track.primaryMood].short} · `}
                    spinning={playing && !reduced}
                    colour={`color-mix(in oklab, ${EMOTION_INFO[track.primaryMood].accent} 55%, #2a1f5c)`}
                    className="absolute -right-3 -top-4 z-10 h-[80px] w-[80px]"
                  />
                </div>
              </SpectrumAura>
            </motion.div>

            <div className="relative z-10 flex items-end gap-3">
              <div className="min-w-0 flex-1">
                <p className="mb-1 text-xs uppercase tracking-[0.16em] text-faint">{EMOTION_INFO[track.primaryMood].label}</p>
                <NowPlayingMeta large />
              </div>
              <FavouriteButton trackId={track.id} title={track.title} size={22} className="h-11 w-11" />
            </div>

            <div>
              <WaveSeek peaks={track.peaks} />
              <div className="mt-1 flex justify-between">
                <TimeLabel which="current" />
                <TimeLabel which="total" />
              </div>
            </div>

            <TransportControls size="lg" />

            <p className="text-center text-sm leading-relaxed text-muted">{track.description}</p>
          </div>
        ) : (
          <div className="py-4">
            <QueueList onPick={() => setTab("now")} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function MobilePlayer() {
  const p = usePlayer();
  const track = p.track;
  if (!track) return null;
  return (
    <>
      <div
        role="region"
        aria-label="Music player"
        className="glass fixed inset-x-2 z-50 flex h-[56px] items-center gap-3 rounded-2xl px-2 ring-1 ring-ink/10 md:hidden"
        style={{ bottom: "calc(var(--nav-h) + 8px)" }}
      >
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl">
          <SpectrumStrip className="absolute inset-x-0 bottom-0 h-full w-full opacity-25" />
        </div>
        <button type="button" onClick={() => p.setExpanded(true)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Open player: ${track.title}`}>
          <div className="h-10 w-10 shrink-0"><Cover seed={track.id} mood={track.primaryMood} artwork={track.artwork} rounded="rounded-lg" /></div>
          <NowPlayingMeta compact />
        </button>
        <FavouriteButton trackId={track.id} title={track.title} size={18} />
        <PlayButton size="sm" />
        <MiniProgress />
      </div>
      <AnimatePresence>{p.expanded && <FullPlayer />}</AnimatePresence>
    </>
  );
}
