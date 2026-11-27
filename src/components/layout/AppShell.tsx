"use client";

import { ChevronLeft, ChevronRight, Compass, Disc3, Heart, House, Library, ListMusic, Sparkles, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Cover } from "@/components/music/Cover";
import { btn, cn } from "@/components/ui/styles";
import { useLibrary } from "@/hooks/useLibrary";
import { catalog, collectionTracks } from "@/lib/catalog";

import { BrandMark } from "./Brand";

const MAIN_NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/experience", label: "Check in", icon: Sparkles },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/originals", label: "Originals", icon: Disc3 },
] as const;

type Filter = "all" | "collections" | "yours";

function LibraryRow({
  href,
  active,
  art,
  title,
  meta,
}: {
  href: string;
  active: boolean;
  art: ReactNode;
  title: string;
  meta: string;
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex items-center gap-3 rounded-md p-2 transition hover:bg-white/[0.07]",
          active && "bg-white/[0.1] hover:bg-white/[0.13]",
        )}
      >
        <span className="h-12 w-12 shrink-0 overflow-hidden rounded-md">{art}</span>
        <span className="min-w-0">
          <span className={cn("block truncate text-[15px]", active ? "text-[var(--atmo-ink)]" : "text-ink")}>{title}</span>
          <span className="block truncate text-[13px] text-muted">{meta}</span>
        </span>
      </Link>
    </li>
  );
}

function Sidebar() {
  const pathname = usePathname();
  const lib = useLibrary();
  const [filter, setFilter] = useState<Filter>("all");

  return (
    <aside className="hidden w-[280px] shrink-0 flex-col gap-2 md:sticky md:top-2 md:flex md:h-[calc(100dvh-var(--player-h)-1rem)] lg:w-[320px]">
      <nav aria-label="Main" className="rounded-lg bg-[var(--panel)] px-3 py-3">
        <Link href="/" className="mb-2 flex items-center gap-2 px-3 py-1.5" aria-label="Sonora home">
          <BrandMark className="h-6 w-6" />
          <span className="font-headline text-[22px] leading-none">Sonora</span>
        </Link>
        <ul>
          {MAIN_NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href) || (n.href === "/discover" && pathname.startsWith("/collections"));
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-4 rounded-md px-3 py-2.5 text-[15px] font-semibold transition",
                    active ? "text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  <n.icon size={22} strokeWidth={active ? 2.4 : 1.9} />
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <section aria-labelledby="your-library" className="flex min-h-0 flex-1 flex-col rounded-lg bg-[var(--panel)]">
        <div className="px-4 pb-2 pt-4">
          <Link id="your-library" href="/profile" className="flex items-center gap-3 px-1 text-[15px] font-semibold text-muted transition hover:text-ink">
            <Library size={22} /> Your Library
          </Link>
          <div role="group" aria-label="Show in library" className="mt-4 flex gap-2">
            {(
              [
                ["all", "All"],
                ["collections", "Collections"],
                ["yours", "Yours"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[13px] transition",
                  filter === value ? "bg-ink text-bg" : "bg-white/[0.08] text-ink hover:bg-white/[0.14]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <ul className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {filter !== "collections" && (
            <>
              <LibraryRow
                href="/profile#favourites"
                active={false}
                art={
                  <span className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#5b4bd8,#b9abff_55%,#f2a97f)]">
                    <Heart size={18} fill="#fff" className="text-white" />
                  </span>
                }
                title="Liked songs"
                meta={`Playlist · ${lib.favourites.length} ${lib.favourites.length === 1 ? "song" : "songs"}`}
              />
              {lib.playlists.map((p) => (
                <LibraryRow
                  key={p.id}
                  href="/profile#playlists"
                  active={false}
                  art={
                    <span className="flex h-full w-full items-center justify-center bg-white/[0.08] text-muted">
                      <ListMusic size={20} />
                    </span>
                  }
                  title={p.title}
                  meta={`Playlist · ${p.trackIds.length} ${p.trackIds.length === 1 ? "song" : "songs"}`}
                />
              ))}
            </>
          )}
          {filter !== "yours" &&
            catalog.collections.map((c) => (
              <LibraryRow
                key={c.id}
                href={`/collections/${c.id}`}
                active={pathname === `/collections/${c.id}`}
                art={<Cover seed={c.id} palette={c.palette} rounded="rounded-md" />}
                title={c.title}
                meta={`Collection · ${collectionTracks(c).length} tracks`}
              />
            ))}
        </ul>
      </section>
    </aside>
  );
}

function TopBar() {
  const router = useRouter();
  return (
    <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <Link href="/" className="flex items-center gap-2 md:hidden" aria-label="Sonora home">
          <BrandMark className="h-7 w-7" />
          <span className="font-headline text-[22px] leading-none">Sonora</span>
        </Link>
        <button type="button" onClick={() => router.back()} aria-label="Go back" className="hidden h-8 w-8 items-center justify-center rounded-full bg-black/45 text-ink transition hover:bg-black/70 md:flex">
          <ChevronLeft size={20} />
        </button>
        <button type="button" onClick={() => router.forward()} aria-label="Go forward" className="hidden h-8 w-8 items-center justify-center rounded-full bg-black/45 text-ink transition hover:bg-black/70 md:flex">
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/experience" className={`${btn.primary} hidden sm:inline-flex`}>
          <Sparkles size={15} /> Check in
        </Link>
        <Link href="/profile" aria-label="Your library and account" className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 p-1 transition hover:scale-105">
          <span className="flex h-full w-full items-center justify-center rounded-full bg-[#2a2531] text-muted">
            <User size={16} />
          </span>
        </Link>
      </div>
    </div>
  );
}

function PanelFooter() {
  return (
    <footer className="mt-16 border-t border-hairline px-4 py-10 text-sm sm:px-6">
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-muted">
        {[
          ["/experience", "Check in"],
          ["/discover", "Discover"],
          ["/originals", "Originals"],
          ["/profile", "Library"],
          ["/privacy", "Privacy"],
        ].map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="tap relative hover:text-ink hover:underline">
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-5 max-w-2xl text-[13px] leading-relaxed text-faint">
        Sonora is a music experience, not a medical or mental-health service. If you&rsquo;re struggling, please reach out to someone you
        trust or find a local helpline at{" "}
        <a className="tap relative underline underline-offset-2 hover:text-ink" href="https://findahelpline.com" target="_blank" rel="noreferrer">
          findahelpline.com
        </a>
        .
      </p>
    </footer>
  );
}

/**
 * The dark listening room around the music pages: a library sidebar on the
 * left and one rounded main panel with a mood-tinted wash at the top.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div data-app-shell="" className="flex gap-2 md:p-2">
      <Sidebar />
      <div className="relative min-w-0 flex-1 overflow-clip bg-[var(--panel)] md:rounded-lg">
        <div aria-hidden="true" className="panel-wash absolute inset-x-0 top-0 h-[420px]" />
        <div className="relative isolate">
          <TopBar />
          {children}
          <PanelFooter />
        </div>
      </div>
    </div>
  );
}
