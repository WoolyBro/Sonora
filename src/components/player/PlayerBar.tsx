"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CircleAlert, ListMusic, RotateCcw } from "lucide-react";

import { Cover } from "@/components/music/Cover";
import { FavouriteButton } from "@/components/music/FavouriteButton";
import { btn, cn } from "@/components/ui/styles";

import { TimeLabel, TransportControls, VolumeControl } from "./Controls";
import { MobilePlayer } from "./MobilePlayer";
import { usePlayer } from "./PlayerProvider";
import { QueuePanel } from "./QueuePanel";
import { WaveSeek } from "./WaveSeek";

export function NowPlayingMeta({ compact = false, large = false }: { compact?: boolean; large?: boolean }) {
  const { track, status, error, toggle } = usePlayer();
  if (!track) return null;
  return (
    <div className="min-w-0">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={track.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
        >
          <p className={cn("truncate font-semibold", compact ? "text-sm" : large ? "font-display text-3xl font-normal" : "text-[15px]")}>{track.title}</p>
          {status === "error" ? (
            <button type="button" onClick={toggle} className="flex items-center gap-1 truncate text-xs text-danger">
              <CircleAlert size={12} /> {error ?? "Unavailable"} <RotateCcw size={11} className="ml-1" /> Retry
            </button>
          ) : (
            <p className={cn("truncate text-muted", large ? "mt-1 text-sm" : "text-xs")}>{track.artist}</p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function PlayerBar() {
  const p = usePlayer();
  if (!p.track) return null;
  const track = p.track;

  return (
    <>
      <QueuePanel />
      <MobilePlayer />
      <motion.div
        role="region"
        aria-label="Music player"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 34 }}
        className="glass fixed inset-x-0 bottom-0 z-50 hidden h-[var(--player-height)] border-t border-hairline md:block"
      >
        <div className="mx-auto grid h-full max-w-[1400px] grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)] items-center gap-6 px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => p.setExpanded(true)} className="h-14 w-14 shrink-0" aria-label="Open full player">
              <Cover seed={track.id} mood={track.primaryMood} artwork={track.artwork} rounded="rounded-xl" />
            </button>
            <NowPlayingMeta />
            <FavouriteButton trackId={track.id} title={track.title} />
          </div>

          <div className="flex flex-col items-center gap-1">
            <TransportControls />
            <div className="flex w-full items-center gap-3">
              <TimeLabel which="current" />
              <WaveSeek peaks={track.peaks} compact />
              <TimeLabel which="total" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => p.setQueueOpen(!p.queueOpen)}
              aria-pressed={p.queueOpen}
              aria-label="Queue"
              className={cn(btn.icon, p.queueOpen && "text-[var(--atmo-accent)]")}
            >
              <ListMusic size={18} />
            </button>
            <VolumeControl />
          </div>
        </div>
      </motion.div>
    </>
  );
}
