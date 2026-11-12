"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { Track } from "@/lib/catalog";
import { playThreshold } from "@/lib/audio/format";
import * as Q from "@/lib/audio/queue";
import { library } from "@/lib/library/store";

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "error";

export interface PlayerContextValue {
  queue: Q.QueueState;
  track: Track | null;
  status: PlayerStatus;
  error: string | null;
  volume: number;
  muted: boolean;
  sourceLabel: string | null;
  expanded: boolean;
  queueOpen: boolean;
  playTracks: (tracks: Track[], start?: number, sourceLabel?: string) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  enqueue: (track: Track) => void;
  playNext: (track: Track) => void;
  removeAt: (index: number) => void;
  jumpTo: (index: number) => void;
  move: (from: number, to: number) => void;
  clearQueue: () => void;
  setExpanded: (v: boolean) => void;
  setQueueOpen: (v: boolean) => void;
}

export interface PlayerTime {
  currentTime: number;
  duration: number | null;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);
const PlayerTimeContext = createContext<PlayerTime>({ currentTime: 0, duration: null });

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}

/** Separate context so the 4 Hz time updates only re-render the seek bar. */
export function usePlayerTime(): PlayerTime {
  return useContext(PlayerTimeContext);
}

const VOLUME_KEY = "sonora:volume";

function fade(audio: HTMLAudioElement, from: number, to: number, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      audio.volume = Math.max(0, Math.min(1, from + (to - from) * p));
      if (p < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [queue, setQueue] = useState<Q.QueueState>(Q.emptyQueue);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  // The player UI only renders once something is queued (never during
  // hydration), so reading the saved volume up front can't cause a mismatch.
  const [volume, setVolumeState] = useState(() => {
    try {
      const saved = typeof window === "undefined" ? NaN : Number(localStorage.getItem(VOLUME_KEY));
      return saved > 0 && saved <= 1 ? saved : 0.8;
    } catch {
      return 0.8;
    }
  });
  const [muted, setMuted] = useState(false);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [time, setTime] = useState<PlayerTime>({ currentTime: 0, duration: null });
  const [loadKey, setLoadKey] = useState(0);

  // Latest values for event handlers registered once; synced after each commit.
  const queueRef = useRef(queue);
  const wantPlay = useRef(false);
  const recorded = useRef(false);
  const fading = useRef(false);
  const targetVolume = muted ? 0 : volume;
  const targetVolumeRef = useRef(targetVolume);
  useLayoutEffect(() => {
    queueRef.current = queue;
    targetVolumeRef.current = targetVolume;
  }, [queue, targetVolume]);

  const track = Q.currentTrack(queue);
  const trackId = track?.id ?? null;

  useEffect(() => {
    const audio = audioRef.current;
    if (audio && !fading.current) audio.volume = targetVolume;
  }, [targetVolume]);

  // Load the current track whenever it changes (or a reload is requested).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const current = Q.currentTrack(queueRef.current);
    let cancelled = false;

    if (!current) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      setStatus("idle");
      setTime({ currentTime: 0, duration: null });
      return;
    }

    (async () => {
      if (!audio.paused && audio.src) {
        fading.current = true;
        await fade(audio, audio.volume, 0, 160);
        fading.current = false;
      }
      if (cancelled) return;
      recorded.current = false;
      setError(null);
      setTime({ currentTime: 0, duration: current.duration });
      audio.src = current.audio;
      audio.load();
      if (!wantPlay.current) {
        audio.volume = targetVolumeRef.current;
        setStatus("paused");
        return;
      }
      setStatus("loading");
      audio.volume = 0;
      try {
        await audio.play();
        if (cancelled) return;
        fading.current = true;
        await fade(audio, 0, targetVolumeRef.current, 280);
        fading.current = false;
      } catch (err) {
        fading.current = false;
        audio.volume = targetVolumeRef.current;
        if (cancelled) return;
        const name = (err as DOMException)?.name;
        if (name === "NotAllowedError") {
          wantPlay.current = false;
          setStatus("paused"); // autoplay blocked: wait for a tap
        }
        // AbortError: superseded by another load; NotSupportedError: handled by the 'error' event.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [trackId, loadKey]);

  const advance = useCallback((auto: boolean) => {
    const audio = audioRef.current;
    const n = Q.next(queueRef.current, auto);
    if (!n) {
      // End of the queue: stop on the last track instead of looping silently.
      wantPlay.current = false;
      audio?.pause();
      if (audio) audio.currentTime = 0;
      setStatus("paused");
      return;
    }
    wantPlay.current = true;
    setQueue(n);
    setLoadKey((k) => k + 1);
  }, []);

  // Audio element events, registered once.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlaying = () => setStatus("playing");
    const onPause = () => {
      if (!audio.ended && !audio.error) setStatus((s) => (s === "loading" && wantPlay.current ? s : "paused"));
    };
    const onWaiting = () => setStatus("loading");
    const onEnded = () => advance(true);
    const onError = () => {
      if (!audio.getAttribute("src")) return;
      wantPlay.current = false;
      setStatus("error");
      setError("This track isn't available right now.");
    };
    const onTime = () => {
      const t = audio.currentTime;
      setTime((prev) => (Math.abs(prev.currentTime - t) < 0.2 ? prev : { ...prev, currentTime: t }));
      const current = Q.currentTrack(queueRef.current);
      if (current && !recorded.current && t >= playThreshold(audio.duration || current.duration)) {
        recorded.current = true;
        library.recordPlay(current.id);
      }
    };
    const onDuration = () => {
      if (Number.isFinite(audio.duration)) setTime((prev) => ({ ...prev, duration: audio.duration }));
    };
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("loadedmetadata", onDuration);
    return () => {
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("loadedmetadata", onDuration);
    };
  }, [advance]);

  // ── actions ──
  const playTracks = useCallback((tracks: Track[], start = 0, label?: string) => {
    if (!tracks.length) return;
    const audio = audioRef.current;
    const startId = tracks[start]?.id;
    const currentId = Q.currentTrack(queueRef.current)?.id;
    wantPlay.current = true;
    setSourceLabel(label ?? null);
    setQueue((s) => Q.setQueue(s, tracks, start));
    if (startId && startId === currentId && audio?.getAttribute("src")) {
      // Same track already loaded: resume rather than restart.
      audio.play().catch(() => setStatus("paused"));
    } else {
      setLoadKey((k) => k + 1);
    }
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !Q.currentTrack(queueRef.current)) return;
    if (status === "error" || !audio.getAttribute("src")) {
      wantPlay.current = true;
      setLoadKey((k) => k + 1);
      return;
    }
    if (audio.paused) {
      wantPlay.current = true;
      audio.play().catch(() => setStatus("paused"));
    } else {
      wantPlay.current = false;
      audio.pause();
    }
  }, [status]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    wantPlay.current = true;
    setQueue((s) => Q.prev(s));
    setLoadKey((k) => k + 1);
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(seconds)) return;
    const max = Number.isFinite(audio.duration) ? audio.duration : (time.duration ?? 0);
    audio.currentTime = Math.max(0, Math.min(max || 0, seconds));
    setTime((t) => ({ ...t, currentTime: audio.currentTime }));
  }, [time.duration]);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    setMuted(clamped === 0);
    try {
      localStorage.setItem(VOLUME_KEY, String(clamped || 0.8));
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<PlayerContextValue>(
    () => ({
      queue,
      track,
      status,
      error,
      volume,
      muted,
      sourceLabel,
      expanded,
      queueOpen,
      playTracks,
      toggle,
      next: () => advance(false),
      prev,
      seek,
      setVolume,
      toggleMute: () => setMuted((m) => !m),
      toggleShuffle: () => setQueue((s) => Q.toggleShuffle(s)),
      cycleRepeat: () => setQueue((s) => Q.cycleRepeat(s)),
      enqueue: (t) => {
        if (!queueRef.current.tracks.length) playTracks([t]);
        else setQueue((s) => Q.enqueue(s, t));
      },
      playNext: (t) => {
        if (!queueRef.current.tracks.length) playTracks([t]);
        else setQueue((s) => Q.playNext(s, t));
      },
      removeAt: (i) => {
        wantPlay.current = !audioRef.current?.paused;
        setQueue((s) => Q.removeAt(s, i));
      },
      jumpTo: (i) => {
        wantPlay.current = true;
        setQueue((s) => Q.jumpTo(s, i));
        setLoadKey((k) => k + 1);
      },
      move: (from, to) => setQueue((s) => Q.move(s, from, to)),
      clearQueue: () => {
        wantPlay.current = false;
        setQueue((s) => Q.clear(s));
        setExpanded(false);
      },
      setExpanded,
      setQueueOpen,
    }),
    [queue, track, status, error, volume, muted, sourceLabel, expanded, queueOpen, playTracks, toggle, advance, prev, seek, setVolume],
  );

  // Lock-screen / hardware media keys.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (!track) {
      ms.metadata = null;
      return;
    }
    ms.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
    });
    ms.setActionHandler("play", () => toggle());
    ms.setActionHandler("pause", () => toggle());
    ms.setActionHandler("nexttrack", () => advance(false));
    ms.setActionHandler("previoustrack", () => prev());
    ms.setActionHandler("seekto", (d) => d.seekTime !== undefined && seek(d.seekTime));
  }, [track, toggle, advance, prev, seek]);

  // Space toggles playback when focus isn't in something that uses the key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, button, a, [role='slider'], [contenteditable='true']")) return;
      if (!Q.currentTrack(queueRef.current)) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  // Reserve space at the bottom of the page for the player.
  useEffect(() => {
    document.documentElement.style.setProperty("--player-h", queue.tracks.length ? "var(--player-height)" : "0px");
  }, [queue.tracks.length]);

  return (
    <PlayerContext.Provider value={value}>
      <PlayerTimeContext.Provider value={time}>
        {children}
        <audio ref={audioRef} preload="metadata" aria-hidden="true" />
      </PlayerTimeContext.Provider>
    </PlayerContext.Provider>
  );
}
