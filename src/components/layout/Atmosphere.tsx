"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { usePlayer } from "@/components/player/PlayerProvider";
import { DEFAULT_ATMOSPHERE, EMOTION_INFO, type Emotion } from "@/lib/emotion/taxonomy";

const AtmosphereContext = createContext<(mood: Emotion | null) => void>(() => {});

/** Pages call this to tint the room (e.g. the emotion result). */
export function useSetAtmosphere() {
  return useContext(AtmosphereContext);
}

export function AtmosphereProvider({ children }: { children: ReactNode }) {
  const [explicit, setExplicit] = useState<Emotion | null>(null);
  const { track, status } = usePlayer();

  // Priority: a mood the page set > the playing track's mood > default dusk.
  const mood = explicit ?? (track && status !== "idle" ? track.primaryMood : null);

  useEffect(() => {
    const root = document.documentElement.style;
    const { palette, accent } = mood ? EMOTION_INFO[mood] : DEFAULT_ATMOSPHERE;
    root.setProperty("--atmo-1", palette[0]);
    root.setProperty("--atmo-2", palette[1]);
    root.setProperty("--atmo-3", palette[2]);
    root.setProperty("--atmo-accent", accent);
  }, [mood]);

  return (
    <AtmosphereContext.Provider value={setExplicit}>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-70">
        <div className="atmo-blob atmo-blob--1" />
        <div className="atmo-blob atmo-blob--2" />
        <div className="atmo-blob atmo-blob--3" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,transparent_0%,var(--bg)_75%)]" />
      </div>
      {children}
    </AtmosphereContext.Provider>
  );
}
