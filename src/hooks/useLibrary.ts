"use client";

import { useSyncExternalStore } from "react";

import { library } from "@/lib/library/store";
import type { LibraryState } from "@/lib/library/types";

export function useLibrary(): LibraryState {
  return useSyncExternalStore(library.subscribe, library.getState, library.getServerState);
}

export function useIsFavourite(trackId: string): boolean {
  return useSyncExternalStore(
    library.subscribe,
    () => library.getState().favourites.includes(trackId),
    () => false,
  );
}
