"use client";

import { ArrowLeft, Play, Shuffle } from "lucide-react";
import Link from "next/link";

import { Cover } from "@/components/music/Cover";
import { TrackRow } from "@/components/music/TrackItems";
import { usePlayer } from "@/components/player/PlayerProvider";
import { btn } from "@/components/ui/styles";
import { collectionTracks, getCollection } from "@/lib/catalog";
import { formatTime } from "@/lib/audio/format";

export function CollectionView({ id }: { id: string }) {
  const player = usePlayer();
  const collection = getCollection(id);
  if (!collection) return null;
  const tracks = collectionTracks(collection);
  const total = tracks.reduce((s, t) => s + (t.duration ?? 0), 0);

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-6 sm:px-6 md:pt-10">
      <Link href="/discover" className={`${btn.ghost} -ml-3`}>
        <ArrowLeft size={16} /> Discover
      </Link>
      <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,22rem)_1fr] md:items-end md:gap-12">
        <div className="mx-auto w-full max-w-[22rem] shadow-2xl shadow-[rgb(42_32_78/0.16)]">
          <Cover seed={collection.id} palette={collection.palette} rounded="rounded-[2rem]" label={`${collection.title} artwork`} />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted">Collection</p>
          <h1 className="font-display mt-3 text-[clamp(2.6rem,6vw,5rem)] leading-none">{collection.title}</h1>
          <p className="mt-5 max-w-xl text-lg text-muted">{collection.description}</p>
          <p className="mt-3 text-sm text-faint">
            {tracks.length} tracks · {Math.round(total / 60)} min
          </p>
          <div className="mt-8 flex gap-3">
            <button type="button" className={`${btn.primary} px-6 py-3`} onClick={() => player.playTracks(tracks, 0, collection.title)}>
              <Play size={16} fill="currentColor" /> Play
            </button>
            <button
              type="button"
              className={`${btn.secondary} px-6 py-3`}
              onClick={() => {
                if (!player.queue.shuffle) player.toggleShuffle();
                player.playTracks(tracks, Math.floor(Math.random() * tracks.length), collection.title);
              }}
            >
              <Shuffle size={16} /> Shuffle
            </button>
          </div>
        </div>
      </div>
      <ul className="mt-12">
        {tracks.map((t, i) => (
          <TrackRow key={t.id} track={t} index={i} onPlay={() => player.playTracks(tracks, i, collection.title)} />
        ))}
      </ul>
      <p className="sr-only">Total length {formatTime(total)}</p>
    </div>
  );
}
