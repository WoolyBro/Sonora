"use client";

import { Heart } from "lucide-react";

import { useToast } from "@/components/ui/Toaster";
import { cn } from "@/components/ui/styles";
import { useIsFavourite } from "@/hooks/useLibrary";
import { library } from "@/lib/library/store";

export function FavouriteButton({ trackId, title, className, size = 18 }: { trackId: string; title: string; className?: string; size?: number }) {
  const fav = useIsFavourite(trackId);
  const toast = useToast();
  return (
    <button
      type="button"
      aria-pressed={fav}
      aria-label={fav ? `Remove ${title} from favourites` : `Add ${title} to favourites`}
      onClick={(e) => {
        e.stopPropagation();
        const on = library.toggleFavourite(trackId);
        toast(on ? "Saved to favourites" : "Removed from favourites");
      }}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-ink/8 active:scale-90",
        fav ? "text-[var(--atmo-ink)]" : "text-muted hover:text-ink",
        className,
      )}
    >
      <Heart size={size} fill={fav ? "currentColor" : "none"} strokeWidth={1.8} />
    </button>
  );
}
