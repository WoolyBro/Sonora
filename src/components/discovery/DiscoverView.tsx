"use client";

import { Play, Search, X } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useMemo, useRef, useState, type ReactNode } from "react";

import { MoodOrb } from "@/components/emotion/MoodPicker";
import { Stagger, StaggerItem } from "@/components/motion/Reveal";
import { CollectionCard } from "@/components/music/CollectionCard";
import { Cover } from "@/components/music/Cover";
import { TrackCard, TrackRow } from "@/components/music/TrackItems";
import { usePlayer } from "@/components/player/PlayerProvider";
import { btn, chipState, cn } from "@/components/ui/styles";
import { catalog, collectionTracks, GENRES } from "@/lib/catalog";
import { EMOTIONS, EMOTION_INFO, type Emotion } from "@/lib/emotion/taxonomy";
import { filterTracks, type EnergyBand, type TrackFilters } from "@/lib/search";

const ENERGY: { value: EnergyBand; label: string }[] = [
  { value: "any", label: "Any energy" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const selectCls =
  "rounded-full bg-ink/[0.04] px-4 py-2 text-sm text-ink ring-1 ring-hairline focus:outline-none focus-visible:ring-[var(--atmo-accent)] [&>option]:bg-raised";

/** A shelf heading with an optional "Show all" link, as on a music app's home. */
function Shelf({ id, title, href, children }: { id: string; title: string; href?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-10">
      <div className="mb-2 flex items-end justify-between gap-4 px-1">
        <h2 id={id} className="text-2xl font-bold tracking-[-0.02em]">
          {title}
        </h2>
        {href && (
          <Link href={href} className="tap relative text-[13px] font-semibold text-muted hover:text-ink hover:underline">
            Show all
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function DiscoverView() {
  const player = usePlayer();
  const [query, setQuery] = useState("");
  const [moods, setMoods] = useState<Emotion[]>([]);
  const [energy, setEnergy] = useState<EnergyBand>("any");
  const [vocals, setVocals] = useState<TrackFilters["vocals"]>("any");
  const [genre, setGenre] = useState("");
  const [collection, setCollection] = useState("");
  const deferredQuery = useDeferredValue(query);
  const searchRef = useRef<HTMLElement>(null);
  const originals = useMemo(() => catalog.tracks.filter((t) => t.isOriginal && t.artwork), []);

  const filters: TrackFilters = { query: deferredQuery, moods, energy, vocals, genre: genre || undefined, collection: collection || undefined };
  const results = useMemo(() => filterTracks(catalog.tracks, filters), [deferredQuery, moods, energy, vocals, genre, collection]); // eslint-disable-line react-hooks/exhaustive-deps
  const active = Boolean(query || moods.length || energy !== "any" || vocals !== "any" || genre || collection);

  const reset = () => {
    setQuery("");
    setMoods([]);
    setEnergy("any");
    setVocals("any");
    setGenre("");
    setCollection("");
  };

  return (
    <div className="px-4 pb-4 sm:px-6">
      <h1 className="font-headline pt-2 text-[clamp(2.4rem,5vw,3.6rem)] leading-none">Find a sound for any state</h1>

      {/* Quick tiles: jump straight into a collection */}
      <Stagger stagger={0.04} className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {catalog.collections.slice(0, 8).map((c) => (
          <StaggerItem key={c.id}>
            <div className="group relative flex h-16 items-center overflow-hidden rounded-md bg-white/[0.08] transition-colors hover:bg-white/[0.16]">
              <Link href={`/collections/${c.id}`} className="flex h-full min-w-0 flex-1 items-center gap-3 pr-16">
                <span className="h-16 w-16 shrink-0 shadow-[4px_0_14px_-4px_rgb(0_0_0/0.5)]">
                  <Cover seed={c.id} palette={c.palette} rounded="rounded-none" />
                </span>
                <span className="truncate text-[15px] font-semibold">{c.title}</span>
              </Link>
              <button
                type="button"
                aria-label={`Play ${c.title}`}
                onClick={() => player.playTracks(collectionTracks(c), 0, c.title)}
                className="play-fab absolute right-3 h-10 w-10 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
              >
                <Play size={16} fill="currentColor" className="ml-0.5" />
              </button>
            </div>
          </StaggerItem>
        ))}
      </Stagger>

      <Shelf id="shelf-collections" title="Collections for every state">
        <div className="-mx-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {catalog.collections.map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}
        </div>
      </Shelf>

      {originals.length > 0 && (
        <Shelf id="shelf-originals" title="Sonora Originals" href="/originals">
          <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:-mx-1 sm:px-1">
            {originals.slice(0, 12).map((t, i) => (
              <TrackCard key={t.id} track={t} onPlay={() => player.playTracks(originals, i, "Sonora Originals")} />
            ))}
          </div>
        </Shelf>
      )}

      <Shelf id="shelf-moods" title="Browse by mood">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {EMOTIONS.map((m) => {
            const info = EMOTION_INFO[m];
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMoods([m]);
                  searchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="group relative aspect-[16/10] overflow-hidden rounded-lg p-4 text-left text-white transition-transform hover:scale-[1.02]"
                style={{ background: `linear-gradient(135deg, ${info.palette[0]}, ${info.palette[2]})` }}
              >
                <span className="relative z-10 block max-w-[70%] text-lg font-bold leading-tight sm:text-xl">{info.label}</span>
                <span className="absolute -bottom-2 -right-4 w-[42%] rotate-[25deg] shadow-[0_6px_20px_rgb(0_0_0/0.45)] transition-transform duration-500 group-hover:rotate-[18deg]">
                  <Cover seed={`mood-${m}`} mood={m} rounded="rounded-md" />
                </span>
              </button>
            );
          })}
        </div>
      </Shelf>

      <section ref={searchRef} aria-labelledby="search-heading" className="mt-14 scroll-mt-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="search-heading" className="text-2xl font-bold tracking-[-0.02em]">Search the library</h2>
          {active && (
            <button type="button" onClick={reset} className={btn.ghost}>
              <X size={15} /> Clear filters
            </button>
          )}
        </div>

        <div className="relative mt-6">
          <Search size={18} className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, moods, genres, instruments…"
            aria-label="Search tracks"
            className="w-full rounded-full bg-ink/[0.04] py-4 pl-12 pr-5 text-base text-ink ring-1 ring-hairline placeholder:text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--atmo-accent)]"
          />
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by mood">
            {EMOTIONS.map((m) => {
              const on = moods.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setMoods(on ? moods.filter((x) => x !== m) : [...moods, m])}
                  className={cn(btn.chip, "shrink-0", chipState(on))}
                >
                  <MoodOrb mood={m} className="h-3.5 w-3.5" /> {EMOTION_INFO[m].label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            <div role="radiogroup" aria-label="Energy" className="flex rounded-full bg-ink/[0.04] p-1 ring-1 ring-hairline">
              {ENERGY.map((e) => (
                <button
                  key={e.value}
                  role="radio"
                  aria-checked={energy === e.value}
                  onClick={() => setEnergy(e.value)}
                  className={cn("rounded-full px-3 py-1.5 text-sm transition", energy === e.value ? "bg-ink/12 text-ink" : "text-muted hover:text-ink")}
                >
                  {e.label}
                </button>
              ))}
            </div>
            <select aria-label="Vocals" value={vocals} onChange={(e) => setVocals(e.target.value as TrackFilters["vocals"])} className={selectCls}>
              <option value="any">Vocal or instrumental</option>
              <option value="instrumental">Instrumental</option>
              <option value="vocal">Vocal</option>
            </select>
            <select aria-label="Genre" value={genre} onChange={(e) => setGenre(e.target.value)} className={selectCls}>
              <option value="">All genres</option>
              {GENRES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <select aria-label="Collection" value={collection} onChange={(e) => setCollection(e.target.value)} className={selectCls}>
              <option value="">All collections</option>
              {catalog.collections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <p className="text-sm text-muted" aria-live="polite">
            {results.length} {results.length === 1 ? "track" : "tracks"}
          </p>
          {results.length > 0 && (
            <button type="button" onClick={() => player.playTracks(results, 0, "Search results")} className={btn.secondary}>
              Play results
            </button>
          )}
        </div>

        {results.length === 0 ? (
          <div className="mt-6 rounded-3xl bg-ink/[0.03] p-10 text-center ring-1 ring-hairline">
            <p className="font-display text-2xl">Nothing matches that yet</p>
            <p className="mt-2 text-sm text-muted">
              {vocals === "vocal"
                ? "The sample library is all instrumental. Add your vocal originals to the catalogue to see them here."
                : "Try fewer filters or a different word."}
            </p>
          </div>
        ) : (
          <ul className="mt-4">
            {results.map((t, i) => (
              <TrackRow key={t.id} track={t} index={i} onPlay={() => player.playTracks(results, i, "Search results")} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
