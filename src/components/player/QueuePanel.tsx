"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, ListX, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { Cover } from "@/components/music/Cover";
import { Equaliser } from "@/components/music/TrackItems";
import { btn, cn } from "@/components/ui/styles";
import * as Q from "@/lib/audio/queue";

import { usePlayer } from "./PlayerProvider";

export function QueueList({ onPick }: { onPick?: () => void }) {
  const p = usePlayer();
  const upcoming = Q.upNext(p.queue);

  if (!p.track) {
    return (
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <p className="font-display text-xl">Your queue is empty</p>
        <p className="mt-2 text-sm text-muted">Check in with how you feel, or start a collection from Discover.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="px-1 text-xs font-medium uppercase tracking-[0.16em] text-faint">Now playing{p.sourceLabel ? ` · ${p.sourceLabel}` : ""}</h3>
        <div className="mt-2 flex items-center gap-3 rounded-xl bg-ink/[0.05] p-2">
          <div className="h-11 w-11 shrink-0"><Cover seed={p.track.id} mood={p.track.primaryMood} artwork={p.track.artwork} rounded="rounded-lg" /></div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 truncate font-medium text-[var(--atmo-ink)]">
              <Equaliser paused={p.status !== "playing"} /> <span className="truncate">{p.track.title}</span>
            </p>
            <p className="truncate text-sm text-muted">{p.track.artist}</p>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-medium uppercase tracking-[0.16em] text-faint">Up next</h3>
          <button type="button" onClick={p.clearQueue} className={cn(btn.ghost, "-mr-2 text-xs")}>
            <ListX size={14} /> Clear queue
          </button>
        </div>
        {upcoming.length === 0 ? (
          <p className="px-1 py-4 text-sm text-muted">
            Nothing after this one{p.queue.repeat === "all" ? " (repeat is on, so it starts again)" : ""}.
          </p>
        ) : (
          <ol className="mt-1 space-y-0.5">
            {upcoming.map(({ track, index }, i) => (
              <li key={track.id} className="group flex items-center gap-3 rounded-xl px-1 py-1.5 hover:bg-ink/[0.04]">
                <button
                  type="button"
                  onClick={() => {
                    p.jumpTo(index);
                    onPick?.();
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  aria-label={`Play ${track.title} now`}
                >
                  <div className="h-10 w-10 shrink-0"><Cover seed={track.id} mood={track.primaryMood} artwork={track.artwork} rounded="rounded-lg" /></div>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{track.title}</span>
                    <span className="block truncate text-xs text-muted">{track.artist}</span>
                  </span>
                </button>
                {!p.queue.shuffle && (
                  <span className="flex opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                    <button type="button" className={btn.icon} aria-label={`Move ${track.title} up`} disabled={i === 0} onClick={() => p.move(index, index - 1)}>
                      <ArrowUp size={15} />
                    </button>
                    <button type="button" className={btn.icon} aria-label={`Move ${track.title} down`} disabled={i === upcoming.length - 1} onClick={() => p.move(index, index + 1)}>
                      <ArrowDown size={15} />
                    </button>
                  </span>
                )}
                <button type="button" className={btn.icon} aria-label={`Remove ${track.title} from queue`} onClick={() => p.removeAt(index)}>
                  <X size={15} />
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

/** Desktop side drawer. */
export function QueuePanel() {
  const { queueOpen, setQueueOpen } = usePlayer();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!queueOpen) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setQueueOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [queueOpen, setQueueOpen]);

  return (
    <AnimatePresence>
      {queueOpen && (
        <motion.aside
          role="dialog"
          aria-label="Queue"
          initial={{ x: "100%", opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0.6 }}
          transition={{ type: "spring", stiffness: 380, damping: 38 }}
          className="glass fixed bottom-[var(--player-h)] right-0 top-0 z-50 hidden w-[380px] overflow-y-auto border-l border-hairline p-5 md:block"
        >
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-display text-2xl">Queue</h2>
            <button ref={closeRef} type="button" onClick={() => setQueueOpen(false)} className={btn.icon} aria-label="Close queue">
              <X size={18} />
            </button>
          </div>
          <QueueList />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
