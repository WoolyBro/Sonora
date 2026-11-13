"use client";

import { Pause, Play } from "lucide-react";
import type { ReactNode } from "react";

import { usePlayer } from "@/components/player/PlayerProvider";
import { cn } from "@/components/ui/styles";
import type { Track } from "@/lib/catalog";
import { formatTime } from "@/lib/audio/format";
import { EMOTION_INFO } from "@/lib/emotion/taxonomy";

import { Cover } from "./Cover";
import { FavouriteButton } from "./FavouriteButton";
import { TrackMenu } from "./TrackMenu";

export function Equaliser({ paused = false, className = "" }: { paused?: boolean; className?: string }) {
  return (
    <span className={cn("eq inline-flex h-3.5 items-end gap-[2px]", className)} data-paused={paused} aria-hidden="true">
      <i className="h-full" />
      <i className="h-full" />
      <i className="h-full" />
    </span>
  );
}

function useTrackState(track: Track) {
  const player = usePlayer();
  const isCurrent = player.track?.id === track.id;
  const isPlaying = isCurrent && (player.status === "playing" || player.status === "loading");
  return { player, isCurrent, isPlaying };
}

export function SampleBadge() {
  return (
    <span
      title="Generated placeholder sketch. Replace with your own music in catalog.json"
      className="rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-faint"
    >
      Sample
    </span>
  );
}

/** Card for horizontal rails (recommendations, collections). */
export function TrackCard({ track, reason, onPlay }: { track: Track; reason?: string; onPlay: () => void }) {
  const { player, isCurrent, isPlaying } = useTrackState(track);
  return (
    <article className="group relative flex w-[11.5rem] shrink-0 snap-start flex-col sm:w-[12.5rem]">
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl transition duration-500 ease-[var(--ease-soft)] md:group-hover:-translate-y-1.5 md:group-hover:shadow-2xl md:group-hover:shadow-black/50",
          isCurrent && "halo",
        )}
      >
        <Cover seed={track.id} mood={track.primaryMood} artwork={track.artwork} className="transition-transform duration-700 ease-[var(--ease-soft)] md:group-hover:scale-[1.06]" />
        <button
          type="button"
          onClick={() => (isCurrent ? player.toggle() : onPlay())}
          aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
          className={cn(
            "absolute bottom-2.5 right-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-ink text-bg shadow-xl shadow-black/40 transition",
            isCurrent ? "opacity-100" : "opacity-100 md:translate-y-1 md:opacity-0 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100 md:group-hover:translate-y-0 md:group-hover:opacity-100",
          )}
        >
          {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
        </button>
      </div>
      <div className="mt-3 flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <h3 className={cn("flex items-center gap-2 truncate text-[15px] font-semibold", isCurrent && "text-[var(--atmo-accent)]")}>
            {isCurrent && <Equaliser paused={!isPlaying} />}
            <span className="truncate">{track.title}</span>
          </h3>
          <p className="truncate text-sm text-muted">{track.artist}</p>
        </div>
        <div className="-mr-2 -mt-1 flex">
          <FavouriteButton trackId={track.id} title={track.title} size={16} />
          <TrackMenu track={track} />
        </div>
      </div>
      {reason && <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-faint">{reason}</p>}
    </article>
  );
}

/** Row for vertical lists (search results, collections, profile). */
export function TrackRow({
  track,
  index,
  onPlay,
  trailing,
}: {
  track: Track;
  index?: number;
  onPlay: () => void;
  trailing?: ReactNode;
}) {
  const { player, isCurrent, isPlaying } = useTrackState(track);
  return (
    <li
      className={cn(
        "group grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.04] sm:grid-cols-[2rem_auto_1fr_auto_auto] sm:px-3",
        isCurrent && "bg-white/[0.04]",
      )}
    >
      <span className="hidden w-8 justify-center text-sm tabular-nums text-faint sm:flex">
        {isCurrent ? <Equaliser paused={!isPlaying} className="text-[var(--atmo-accent)]" /> : index !== undefined ? index + 1 : null}
      </span>
      <button
        type="button"
        onClick={() => (isCurrent ? player.toggle() : onPlay())}
        aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg"
      >
        <Cover seed={track.id} mood={track.primaryMood} artwork={track.artwork} rounded="rounded-lg" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
        </span>
      </button>
      <div className="min-w-0">
        <p className={cn("flex items-center gap-2 truncate font-medium", isCurrent && "text-[var(--atmo-accent)]")}>
          <span className="truncate">{track.title}</span>
          {track.isSample && <span className="hidden md:inline"><SampleBadge /></span>}
        </p>
        <p className="truncate text-sm text-muted">
          {track.artist} <span className="text-faint">· {track.genre}</span>
        </p>
      </div>
      <span className="hidden text-sm text-faint md:block">{EMOTION_INFO[track.primaryMood].label}</span>
      <div className="flex items-center gap-0.5">
        <span className="mr-1 hidden w-10 text-right text-sm tabular-nums text-faint sm:block">{formatTime(track.duration)}</span>
        <FavouriteButton trackId={track.id} title={track.title} size={16} />
        {trailing}
        <TrackMenu track={track} />
      </div>
    </li>
  );
}
