"use client";

import { Play, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { usePlayer } from "@/components/player/PlayerProvider";
import { TrackCard } from "@/components/music/TrackItems";
import { btn, chipState, cn } from "@/components/ui/styles";
import { useLibrary } from "@/hooks/useLibrary";
import { catalog, getTrack, type Track } from "@/lib/catalog";
import { EMOTION_INFO } from "@/lib/emotion/taxonomy";
import type { EmotionProfile } from "@/lib/emotion/types";
import { library } from "@/lib/library/store";
import { recommend, type ShiftDirection } from "@/lib/recommendations/engine";

import { MoodOrb } from "./MoodPicker";

interface Item {
  track: Track;
  reason: string;
}
interface Groups {
  meet: Item[];
  shift: Item[];
  explore: Item[];
  shiftDirection: ShiftDirection;
  preferenceRelaxed: boolean;
}

const collectionTitles = new Map(catalog.collections.map((c) => [c.id, c.title]));

function Rail({ title, subtitle, items, label, action }: { title: string; subtitle: string; items: Item[]; label: string; action?: React.ReactNode }) {
  const player = usePlayer();
  const tracks = items.map((i) => i.track);
  return (
    <section aria-label={title} className="mt-14 first:mt-0">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <Reveal y={14}>
          <h2 className="font-display text-3xl sm:text-4xl">{title}</h2>
          <p className="mt-1.5 text-muted">{subtitle}</p>
        </Reveal>
        <div className="flex flex-wrap items-center gap-2">
          {action}
          {tracks.length > 0 && (
            <button type="button" className={btn.secondary} onClick={() => player.playTracks(tracks, 0, label)}>
              <Play size={15} fill="currentColor" /> Play all
            </button>
          )}
        </div>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-white/[0.03] p-6 text-sm text-muted ring-1 ring-hairline">
          Nothing in the library fits this direction yet. Add more tracks to the catalogue to fill it.
        </p>
      ) : (
        // Re-keyed on the picks, so switching calmer/brighter re-plays the cascade.
        <Stagger
          key={items.map((i) => i.track.id).join()}
          stagger={0.07}
          className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 pt-2 sm:-mx-6 sm:px-6"
        >
          {items.map((item, i) => (
            <StaggerItem key={item.track.id} className="shrink-0 snap-start">
              <TrackCard track={item.track} reason={item.reason} onPlay={() => player.playTracks(tracks, i, label)} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </section>
  );
}

export function Recommendations({ profile, onAdjust, onRestart }: { profile: EmotionProfile; onAdjust: () => void; onRestart: () => void }) {
  const { prefs } = useLibrary();
  const [shift, setShift] = useState<ShiftDirection | null>(null);
  const [groups, setGroups] = useState<Groups | null>(null);
  const [offline, setOffline] = useState(false);
  // Snapshot listening context once per check-in, so the lists don't reshuffle
  // while you're listening to them (each play updates history).
  const [context] = useState(() => {
    const { favourites, history } = library.getState();
    return { favouriteIds: favourites.slice(0, 200), recentIds: history.slice(0, 50).map((h) => h.trackId) };
  });

  const request = useMemo(
    () => ({
      profile,
      shift: shift ?? undefined,
      preferences: { vocals: prefs.vocals, genres: prefs.genres },
      ...context,
    }),
    [profile, shift, prefs.vocals, prefs.genres, context],
  );

  const localFallback = useCallback(() => {
    const r = recommend(profile, catalog.tracks, request, collectionTitles);
    const strip = (g: typeof r.meet) => g.map(({ track, reason }) => ({ track, reason }));
    return { meet: strip(r.meet), shift: strip(r.shift), explore: strip(r.explore), shiftDirection: r.shiftDirection, preferenceRelaxed: r.preferenceRelaxed };
  }, [profile, request]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        });
        if (!res.ok) throw new Error(String(res.status));
        const body = await res.json();
        const map = (g: { trackId: string; reason: string }[]) =>
          g.map((x) => ({ track: getTrack(x.trackId), reason: x.reason })).filter((x): x is Item => Boolean(x.track));
        if (!cancelled) {
          setOffline(false);
          setGroups({ meet: map(body.meet), shift: map(body.shift), explore: map(body.explore), shiftDirection: body.shiftDirection, preferenceRelaxed: body.preferenceRelaxed });
        }
      } catch {
        // Same engine, run locally: works offline and if the API is down.
        if (!cancelled) {
          setOffline(true);
          setGroups(localFallback());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [request, localFallback]);

  const info = EMOTION_INFO[profile.primaryEmotion];
  const direction = groups?.shiftDirection ?? shift ?? "calmer";

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <div className="mb-12 flex flex-wrap items-center justify-between gap-4 rounded-[1.75rem] bg-surface p-4 ring-1 ring-hairline sm:p-5">
        <div className="flex items-center gap-4">
          <MoodOrb mood={profile.primaryEmotion} className="h-11 w-11" />
          <div>
            <p className="text-sm text-muted">Listening for</p>
            <p className="font-semibold">
              {info.label} · {Math.round(profile.intensity * 100)}%
              {profile.secondaryEmotions.length > 0 && (
                <span className="font-normal text-muted"> with {profile.secondaryEmotions.map((s) => EMOTION_INFO[s].short).join(" & ")}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={onAdjust} className={btn.ghost}>
            <SlidersHorizontal size={15} /> Adjust
          </button>
          <button type="button" onClick={onRestart} className={btn.ghost}>
            <RotateCcw size={15} /> New check-in
          </button>
        </div>
      </div>

      {groups?.preferenceRelaxed && (
        <p className="mb-8 text-sm text-faint">
          Your library doesn&rsquo;t have enough {prefs.vocals} tracks yet, so we&rsquo;ve included everything.
        </p>
      )}
      {offline && <p className="mb-8 text-sm text-faint">Working offline: recommendations were calculated on this device.</p>}

      {!groups ? (
        <div className="space-y-14" aria-busy="true" aria-label="Loading recommendations">
          {[0, 1].map((k) => (
            <div key={k}>
              <div className="skeleton h-9 w-72 rounded-xl" />
              <div className="mt-6 flex gap-5 overflow-hidden">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="skeleton aspect-square w-[11.5rem] shrink-0 rounded-2xl sm:w-[12.5rem]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <Rail
            title="Meet your mood"
            subtitle={`Music that sits with feeling ${info.short}, at the strength you feel it.`}
            items={groups.meet}
            label="Meet your mood"
          />
          <Rail
            title="Shift your atmosphere"
            subtitle={direction === "calmer" ? "A slightly calmer room. A direction to try, not a fix." : "A little more light and lift, if you want it."}
            items={groups.shift}
            label="Shift your atmosphere"
            action={
              <div role="radiogroup" aria-label="Shift direction" className="flex rounded-full bg-white/[0.04] p-1 ring-1 ring-hairline">
                {(["calmer", "brighter"] as const).map((d) => (
                  <button
                    key={d}
                    role="radio"
                    aria-checked={direction === d}
                    onClick={() => setShift(d)}
                    className={cn("rounded-full px-3.5 py-1.5 text-sm capitalize ring-0 transition", chipState(direction === d), "ring-0")}
                  >
                    {d}
                  </button>
                ))}
              </div>
            }
          />
          <Rail title="Explore something different" subtitle="Related, but a different texture: for when you want variety." items={groups.explore} label="Explore" />
        </>
      )}
    </div>
  );
}
