"use client";

import { Search, X } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import { MoodOrb } from "@/components/emotion/MoodPicker";
import { CollectionCard } from "@/components/music/CollectionCard";
import { TrackRow } from "@/components/music/TrackItems";
import { usePlayer } from "@/components/player/PlayerProvider";
import { btn, chipState, cn } from "@/components/ui/styles";
import { catalog, GENRES } from "@/lib/catalog";
import { EMOTIONS, EMOTION_INFO, type Emotion } from "@/lib/emotion/taxonomy";
import { filterTracks, type EnergyBand, type TrackFilters } from "@/lib/search";

const ENERGY: { value: EnergyBand; label: string }[] = [
  { value: "any", label: "Any energy" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const selectCls =
  "rounded-full bg-white/[0.04] px-4 py-2 text-sm text-ink ring-1 ring-hairline focus:outline-none focus-visible:ring-[var(--atmo-accent)] [&>option]:bg-raised";

export function DiscoverView() {
  const player = usePlayer();
  const [query, setQuery] = useState("");
  const [moods, setMoods] = useState<Emotion[]>([]);
  const [energy, setEnergy] = useState<EnergyBand>("any");
  const [vocals, setVocals] = useState<TrackFilters["vocals"]>("any");
  const [genre, setGenre] = useState("");
  const [collection, setCollection] = useState("");
  const deferredQuery = useDeferredValue(query);

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
    <div className="mx-auto max-w-[1400px] px-4 pt-6 sm:px-6 md:pt-12">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted">Discover</p>
      <h1 className="font-display mt-4 text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.02]">Find a sound for any state.</h1>

      <section aria-label="Collections" className="mt-12">
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {catalog.collections.map((c) => (
            <CollectionCard key={c.id} collection={c} />
          ))}
        </div>
      </section>

      <section aria-labelledby="search-heading" className="mt-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="search-heading" className="font-display text-3xl sm:text-4xl">Search the library</h2>
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
            className="w-full rounded-full bg-white/[0.04] py-4 pl-12 pr-5 text-base text-ink ring-1 ring-hairline placeholder:text-faint focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--atmo-accent)]"
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
            <div role="radiogroup" aria-label="Energy" className="flex rounded-full bg-white/[0.04] p-1 ring-1 ring-hairline">
              {ENERGY.map((e) => (
                <button
                  key={e.value}
                  role="radio"
                  aria-checked={energy === e.value}
                  onClick={() => setEnergy(e.value)}
                  className={cn("rounded-full px-3 py-1.5 text-sm transition", energy === e.value ? "bg-white/12 text-ink" : "text-muted hover:text-ink")}
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
          <div className="mt-6 rounded-3xl bg-white/[0.03] p-10 text-center ring-1 ring-hairline">
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
