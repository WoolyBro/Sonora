"use client";

import { Clock3, Pause, Play, Shuffle } from "lucide-react";
import type { CSSProperties } from "react";

import { Cover } from "@/components/music/Cover";
import { TrackRow } from "@/components/music/TrackItems";
import { usePlayer } from "@/components/player/PlayerProvider";
import { cn } from "@/components/ui/styles";
import { collectionTracks, getCollection } from "@/lib/catalog";
import { formatTime } from "@/lib/audio/format";

export function CollectionView({ id }: { id: string }) {
  const player = usePlayer();
  const collection = getCollection(id);
  if (!collection) return null;
  const tracks = collectionTracks(collection);
  const total = tracks.reduce((s, t) => s + (t.duration ?? 0), 0);
  const playingHere = player.sourceLabel === collection.title && player.status === "playing";

  return (
    // The header washes in the collection's own colour.
    <div style={{ "--wash": collection.palette[0] } as CSSProperties}>
      <div aria-hidden="true" className="panel-wash pointer-events-none absolute inset-x-0 top-0 -z-10 h-[440px]" />
      <header className="flex flex-col gap-6 px-4 pb-6 pt-2 sm:px-6 md:flex-row md:items-end">
        <div className="mx-auto w-[min(60vw,232px)] shrink-0 shadow-[0_18px_50px_-12px_rgb(0_0_0/0.7)] md:mx-0">
          <Cover seed={collection.id} palette={collection.palette} rounded="rounded-md" label={`${collection.title} artwork`} />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium">Collection</p>
          <h1 className="font-headline mt-1 text-[clamp(2.4rem,7vw,5.5rem)] leading-[0.95]">{collection.title}</h1>
          <p className="mt-4 max-w-2xl text-[15px] text-muted">{collection.description}</p>
          <p className="mt-2 text-[14px]">
            <span className="font-semibold">Sonora</span>
            <span className="text-muted">
              {" "}
              · {tracks.length} tracks, about {Math.max(1, Math.round(total / 60))} min
            </span>
          </p>
        </div>
      </header>

      <div className="bg-[linear-gradient(180deg,rgb(0_0_0/0.22),transparent_220px)] px-4 pt-5 sm:px-6">
        <div className="flex items-center gap-5">
          <button
            type="button"
            className="play-fab h-14 w-14"
            aria-label={playingHere ? `Pause ${collection.title}` : `Play ${collection.title}`}
            onClick={() => (playingHere ? player.toggle() : player.playTracks(tracks, 0, collection.title))}
          >
            {playingHere ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="ml-0.5" />}
          </button>
          <button
            type="button"
            aria-label="Shuffle play"
            aria-pressed={player.queue.shuffle}
            className={cn("tap relative transition hover:scale-105", player.queue.shuffle ? "text-[var(--atmo-ink)]" : "text-muted hover:text-ink")}
            onClick={() => {
              if (!player.queue.shuffle) player.toggleShuffle();
              player.playTracks(tracks, Math.floor(Math.random() * tracks.length), collection.title);
            }}
          >
            <Shuffle size={28} />
          </button>
        </div>

        <div className="mt-6 hidden grid-cols-[2rem_1fr_auto] items-center gap-3 border-b border-hairline px-3 pb-2 text-[13px] text-muted sm:grid">
          <span className="text-center">#</span>
          <span>Title</span>
          <Clock3 size={15} aria-label="Duration" className="mr-[4.75rem]" />
        </div>
        <ul className="mt-2">
          {tracks.map((t, i) => (
            <TrackRow key={t.id} track={t} index={i} onPlay={() => player.playTracks(tracks, i, collection.title)} />
          ))}
        </ul>
        <p className="sr-only">Total length {formatTime(total)}</p>
      </div>
    </div>
  );
}
