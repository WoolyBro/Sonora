"use client";

import { Play } from "lucide-react";
import Link from "next/link";

import { usePlayer } from "@/components/player/PlayerProvider";
import { collectionTracks, type Collection } from "@/lib/catalog";

import { Cover } from "./Cover";

export function CollectionCard({ collection, size = "md" }: { collection: Collection; size?: "md" | "lg" }) {
  const player = usePlayer();
  const tracks = collectionTracks(collection);
  return (
    <article className="group relative">
      <Link href={`/collections/${collection.id}`} className="block rounded-3xl focus-visible:outline-offset-4">
        <div className="relative overflow-hidden rounded-3xl">
          <Cover seed={collection.id} palette={collection.palette} rounded="rounded-3xl" className="transition duration-700 ease-[var(--ease-soft)] group-hover:scale-[1.03]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/60">{tracks.length} tracks</p>
            <h3 className={`font-display mt-1 text-white ${size === "lg" ? "text-3xl" : "text-2xl"}`}>{collection.title}</h3>
          </div>
        </div>
        <p className="mt-3 line-clamp-2 text-sm text-muted">{collection.description}</p>
      </Link>
      <button
        type="button"
        onClick={() => player.playTracks(tracks, 0, collection.title)}
        aria-label={`Play ${collection.title}`}
        className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-ink text-bg shadow-xl shadow-black/40 transition md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
      >
        <Play size={18} fill="currentColor" className="ml-0.5" />
      </button>
    </article>
  );
}
