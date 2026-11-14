"use client";

import { LoaderCircle, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from "lucide-react";

import { cn } from "@/components/ui/styles";
import { formatTime } from "@/lib/audio/format";

import { usePlayer, usePlayerTime } from "./PlayerProvider";

export function PlayButton({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const { status, toggle, track } = usePlayer();
  const playing = status === "playing";
  const loading = status === "loading";
  const dim = size === "lg" ? "h-16 w-16" : size === "md" ? "h-11 w-11" : "h-10 w-10";
  const icon = size === "lg" ? 26 : 18;
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!track}
      aria-label={playing || loading ? "Pause" : "Play"}
      className={cn(dim, "relative flex items-center justify-center rounded-full bg-ink text-bg transition hover:scale-105 active:scale-95 disabled:opacity-40")}
    >
      {loading ? (
        <LoaderCircle size={icon} className="animate-spin" />
      ) : playing ? (
        <Pause size={icon} fill="currentColor" />
      ) : (
        <Play size={icon} fill="currentColor" className="ml-0.5" />
      )}
    </button>
  );
}

export function TransportControls({ size = "md" }: { size?: "md" | "lg" }) {
  const p = usePlayer();
  const iconSize = size === "lg" ? 24 : 18;
  const RepeatIcon = p.queue.repeat === "one" ? Repeat1 : Repeat;
  const toggleCls = (on: boolean) =>
    cn("inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-ink/8", on ? "text-[var(--atmo-ink)]" : "text-muted hover:text-ink");
  return (
    <div className={cn("flex items-center", size === "lg" ? "justify-between gap-2" : "gap-2")}>
      <button type="button" onClick={p.toggleShuffle} aria-pressed={p.queue.shuffle} aria-label="Shuffle" className={toggleCls(p.queue.shuffle)}>
        <Shuffle size={size === "lg" ? 20 : 16} />
      </button>
      <button type="button" onClick={p.prev} disabled={!p.track} aria-label="Previous track" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink/90 transition hover:bg-ink/8 disabled:opacity-30">
        <SkipBack size={iconSize} fill="currentColor" />
      </button>
      <PlayButton size={size === "lg" ? "lg" : "md"} />
      <button type="button" onClick={p.next} disabled={!p.track} aria-label="Next track" className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink/90 transition hover:bg-ink/8 disabled:opacity-30">
        <SkipForward size={iconSize} fill="currentColor" />
      </button>
      <button
        type="button"
        onClick={p.cycleRepeat}
        aria-label={`Repeat: ${p.queue.repeat === "off" ? "off" : p.queue.repeat === "all" ? "all" : "one track"}`}
        aria-pressed={p.queue.repeat !== "off"}
        className={toggleCls(p.queue.repeat !== "off")}
      >
        <RepeatIcon size={size === "lg" ? 20 : 16} />
      </button>
    </div>
  );
}

export function TimeLabel({ which }: { which: "current" | "total" }) {
  const { currentTime, duration } = usePlayerTime();
  const { track } = usePlayer();
  return (
    <span className="w-10 shrink-0 text-xs tabular-nums text-faint" aria-hidden="true">
      {which === "current" ? formatTime(currentTime) : formatTime(duration ?? track?.duration)}
    </span>
  );
}

export function VolumeControl() {
  const { volume, muted, setVolume, toggleMute } = usePlayer();
  const level = muted ? 0 : volume;
  const Icon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={toggleMute} aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-ink/8 hover:text-ink">
        <Icon size={18} />
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(level * 100)}
        onChange={(e) => setVolume(Number(e.target.value) / 100)}
        aria-label="Volume"
        className="range w-24"
        style={{ ["--fill" as string]: `${level * 100}%` }}
      />
    </div>
  );
}
