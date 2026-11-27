"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { usePlayer } from "@/components/player/PlayerProvider";
import { DEFAULT_ATMOSPHERE, EMOTION_INFO, LANDING_ATMOSPHERE, type Emotion } from "@/lib/emotion/taxonomy";

import { DotField } from "./DotField";

const AtmosphereContext = createContext<(mood: Emotion | null) => void>(() => {});

/** Pages call this to tint the room (e.g. the emotion result). */
export function useSetAtmosphere() {
  return useContext(AtmosphereContext);
}

export function AtmosphereProvider({ children }: { children: ReactNode }) {
  const [explicit, setExplicit] = useState<Emotion | null>(null);
  const { track, status } = usePlayer();

  // Priority: a mood the page set > the playing track's mood > the landing's golden hour / default dusk.
  const mood = explicit ?? (track && status !== "idle" ? track.primaryMood : null);
  const landing = usePathname() === "/";

  useEffect(() => {
    const root = document.documentElement.style;
    const { palette, accent } = mood ? EMOTION_INFO[mood] : landing ? LANDING_ATMOSPHERE : DEFAULT_ATMOSPHERE;
    root.setProperty("--atmo-1", palette[0]);
    root.setProperty("--atmo-2", palette[1]);
    root.setProperty("--atmo-3", palette[2]);
    root.setProperty("--atmo-accent", accent);
    if (!mood && landing) root.setProperty("--atmo-glow", LANDING_ATMOSPHERE.glow);
    else root.removeProperty("--atmo-glow");
  }, [mood, landing]);

  return (
    <AtmosphereContext.Provider value={setExplicit}>
      {/* Grainy pastel gradient (grain is the body's .grain layer) that follows the mood… */}
      <div aria-hidden="true" data-atmo="" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="atmo-blob atmo-blob--1" />
        <div className="atmo-blob atmo-blob--2" />
        <div className="atmo-blob atmo-blob--3" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,color-mix(in_oklab,var(--bg)_55%,transparent)_80%)]" />
      </div>
      {/* …with the dotted landscape and the pointer's light on top. */}
      <div data-atmo="">
        <DotField />
      </div>
      {children}
    </AtmosphereContext.Provider>
  );
}
