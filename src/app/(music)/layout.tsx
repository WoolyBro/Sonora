import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";

/** Discover, collections, Originals and the Library share the dark app shell. */
export default function MusicLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
