"use client";

import { Play } from "lucide-react";
import Link from "next/link";

import { usePlayer } from "@/components/player/PlayerProvider";
import { collectionTracks, type Collection } from "@/lib/catalog";

import { Cover } from "./Cover";

/**
 * Shelf card: square art, title and a two-line description, on a panel that
 * lights up on hover while a round play button rises into the art's corner.
 */
export function CollectionCard({ collection }: { collection: Collection; size?: "md" | "lg" }) {
  const player = usePlayer();
  const tracks = collectionTracks(collection);
  return (
    <article className="group relative h-full rounded-lg p-3 transition-colors duration-300 hover:bg-white/[0.07] focus-within:bg-white/[0.07]">
      <div className="relative overflow-hidden rounded-md shadow-[0_10px_30px_-10px_rgb(0_0_0/0.6)]">
        <Link href={`/collections/${collection.id}`} tabIndex={-1} aria-hidden="true">
          <Cover seed={collection.id} palette={collection.palette} rounded="rounded-md" />
        </Link>
        <button
          type="button"
          onClick={() => player.playTracks(tracks, 0, collection.title)}
          aria-label={`Play ${collection.title}`}
          className="play-fab absolute bottom-2 right-2 h-12 w-12 md:translate-y-2 md:opacity-0 md:group-focus-within:translate-y-0 md:group-focus-within:opacity-100 md:group-hover:translate-y-0 md:group-hover:opacity-100"
        >
          <Play size={20} fill="currentColor" className="ml-0.5" />
        </button>
      </div>
      <Link href={`/collections/${collection.id}`} className="mt-3 block rounded-sm focus-visible:outline-offset-2">
        <h3 className="truncate text-[15px] font-semibold">{collection.title}</h3>
        <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted">{collection.description || `${tracks.length} tracks`}</p>
      </Link>
    </article>
  );
}
