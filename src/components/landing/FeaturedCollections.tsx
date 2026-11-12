"use client";

import { CollectionCard } from "@/components/music/CollectionCard";
import { getCollection } from "@/lib/catalog";

export function FeaturedCollections({ ids }: { ids: string[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 lg:grid-cols-4">
      {ids.map((id) => {
        const c = getCollection(id);
        return c ? (
          <div key={id} className="w-[72vw] shrink-0 snap-start sm:w-auto">
            <CollectionCard collection={c} />
          </div>
        ) : null;
      })}
    </div>
  );
}
