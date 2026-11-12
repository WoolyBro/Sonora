"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { library } from "@/lib/library/store";
import type { LibraryUser } from "@/lib/library/types";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";

interface AuthContextValue {
  configured: boolean;
  user: LibraryUser | null;
  ready: boolean;
  sendMagicLink: (email: string) => Promise<{ ok: boolean; message: string }>;
  signOut: () => Promise<void>;
  accessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<LibraryUser | null>(null);
  const [ready, setReady] = useState(!configured);

  useEffect(() => {
    library.hydrate();
    const sb = getBrowserSupabase();
    if (!sb) return;

    const apply = (session: { user: { id: string; email?: string | null } } | null) => {
      if (session?.user) {
        const u = { id: session.user.id, email: session.user.email ?? null };
        setUser(u);
        void library.attachUser(sb, u);
      } else {
        setUser((prev) => {
          if (prev) library.detachUser();
          return null;
        });
      }
    };

    sb.auth.getSession().then(({ data }) => {
      apply(data.session);
      setReady(true);
    });
    const { data } = sb.auth.onAuthStateChange((_event, session) => apply(session));
    return () => data.subscription.unsubscribe();
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    const sb = getBrowserSupabase();
    if (!sb) return { ok: false, message: "Accounts aren't enabled on this deployment." };
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/profile` },
    });
    if (error) return { ok: false, message: "Couldn't send the link. Check the address and try again." };
    return { ok: true, message: `Check ${email} for a sign-in link.` };
  }, []);

  const signOut = useCallback(async () => {
    await getBrowserSupabase()?.auth.signOut();
    library.detachUser();
    setUser(null);
  }, []);

  const accessToken = useCallback(async () => {
    const { data } = (await getBrowserSupabase()?.auth.getSession()) ?? { data: { session: null } };
    return data.session?.access_token ?? null;
  }, []);

  const value = useMemo(
    () => ({ configured, user, ready, sendMagicLink, signOut, accessToken }),
    [configured, user, ready, sendMagicLink, signOut, accessToken],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
