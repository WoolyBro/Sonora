"use client";

import type { ReactNode } from "react";

import { PlayerBar } from "@/components/player/PlayerBar";
import { PlayerProvider } from "@/components/player/PlayerProvider";
import { ToastProvider } from "@/components/ui/Toaster";

import { AtmosphereProvider } from "./Atmosphere";
import { AuthProvider } from "./AuthProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <PlayerProvider>
          <AtmosphereProvider>
            {children}
            <PlayerBar />
          </AtmosphereProvider>
        </PlayerProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
