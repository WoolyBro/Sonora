"use client";

import { ChevronDown, LogOut, Mail, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";

import { MoodOrb } from "@/components/emotion/MoodPicker";
import { useAuth } from "@/components/layout/AuthProvider";
import { TrackRow } from "@/components/music/TrackItems";
import { usePlayer } from "@/components/player/PlayerProvider";
import { useToast } from "@/components/ui/Toaster";
import { btn, chipState, cn } from "@/components/ui/styles";
import { useLibrary } from "@/hooks/useLibrary";
import { GENRES, getTracks } from "@/lib/catalog";
import { EMOTION_INFO } from "@/lib/emotion/taxonomy";
import { library } from "@/lib/library/store";

function Section({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 rounded-[2rem] bg-surface p-5 ring-1 ring-hairline sm:p-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${id}-h`} className="font-display text-2xl sm:text-3xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-ink/[0.03] p-5 text-sm text-muted ring-1 ring-hairline">{children}</p>;
}

function Account() {
  const auth = useAuth();
  const { prefs, syncing, syncError } = useLibrary();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState<string | null>(null);

  if (!auth.user) {
    return (
      <div className="grid gap-6 md:grid-cols-[1fr_1fr] md:items-center">
        <div>
          <p className="text-sm text-faint">Listening as a guest</p>
          <p className="mt-2 text-muted">
            Everything you save lives in this browser only. {auth.configured ? "Sign in to keep it across devices." : "Accounts aren't enabled on this deployment."}
          </p>
        </div>
        {auth.configured && (
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const r = await auth.sendMagicLink(email.trim());
              setSent(r.message);
              setBusy(false);
            }}
          >
            <label htmlFor="email" className="sr-only">Email address</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="min-w-0 flex-1 rounded-full bg-ink/[0.05] px-5 py-3 text-sm ring-1 ring-hairline placeholder:text-faint focus:outline-none focus-visible:ring-[var(--atmo-accent)]"
            />
            <button type="submit" disabled={busy} className={btn.primary}>
              <Mail size={15} /> Email me a link
            </button>
            {sent && <p role="status" className="text-sm text-muted sm:basis-full">{sent}</p>}
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-faint">Signed in as {auth.user.email}</p>
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (name !== null) library.updatePrefs({ displayName: name.trim().slice(0, 60) });
            setName(null);
          }}
        >
          <label htmlFor="display-name" className="sr-only">Display name</label>
          <input
            id="display-name"
            value={name ?? prefs.displayName}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add a display name"
            maxLength={60}
            className="font-display min-w-0 bg-transparent text-2xl placeholder:text-faint focus:outline-none"
          />
          {name !== null && <button type="submit" className={btn.secondary}>Save</button>}
          {name === null && <Pencil size={15} className="text-faint" aria-hidden="true" />}
        </form>
        {syncing && <p className="mt-1 text-xs text-faint">Syncing your library…</p>}
        {syncError && (
          <p role="alert" className="mt-1 flex items-center gap-2 text-xs text-danger">
            {syncError}
            <button type="button" onClick={() => library.clearSyncError()} aria-label="Dismiss"><X size={12} /></button>
          </p>
        )}
      </div>
      <button type="button" onClick={() => auth.signOut()} className={btn.secondary}>
        <LogOut size={15} /> Sign out
      </button>
    </div>
  );
}

function Playlists() {
  const { playlists } = useLibrary();
  const player = usePlayer();
  const [open, setOpen] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);

  return (
    <Section
      id="playlists"
      title="Playlists"
      action={
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            library.createPlaylist(newName);
            setNewName("");
          }}
        >
          <label htmlFor="new-playlist" className="sr-only">New playlist name</label>
          <input
            id="new-playlist"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New playlist"
            maxLength={80}
            className="w-40 rounded-full bg-ink/[0.05] px-4 py-2 text-sm ring-1 ring-hairline placeholder:text-faint focus:outline-none focus-visible:ring-[var(--atmo-accent)] sm:w-52"
          />
          <button type="submit" className={btn.secondary} aria-label="Create playlist"><Plus size={15} /></button>
        </form>
      }
    >
      {playlists.length === 0 ? (
        <Empty>No playlists yet. Create one here, or use the ••• menu on any track.</Empty>
      ) : (
        <ul className="space-y-2">
          {playlists.map((p) => {
            const tracks = getTracks(p.trackIds);
            const expanded = open === p.id;
            return (
              <li key={p.id} className="rounded-2xl bg-ink/[0.03] ring-1 ring-hairline">
                <div className="flex items-center gap-2 p-2 pl-4">
                  {renaming?.id === p.id ? (
                    <form
                      className="flex flex-1 gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        library.renamePlaylist(p.id, renaming.title);
                        setRenaming(null);
                      }}
                    >
                      <input
                        autoFocus
                        aria-label="Playlist name"
                        value={renaming.title}
                        maxLength={80}
                        onChange={(e) => setRenaming({ id: p.id, title: e.target.value })}
                        className="min-w-0 flex-1 rounded-lg bg-ink/8 px-3 py-1.5 text-sm focus:outline-none"
                      />
                      <button type="submit" className={btn.secondary}>Save</button>
                    </form>
                  ) : (
                    <button type="button" onClick={() => setOpen(expanded ? null : p.id)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <ChevronDown size={16} className={cn("shrink-0 text-faint transition", expanded && "rotate-180")} />
                      <span className="truncate font-medium">{p.title}</span>
                      <span className="shrink-0 text-sm text-faint">· {tracks.length}</span>
                    </button>
                  )}
                  <button type="button" className={btn.icon} disabled={!tracks.length} aria-label={`Play ${p.title}`} onClick={() => player.playTracks(tracks, 0, p.title)}>
                    <Play size={15} fill="currentColor" />
                  </button>
                  <button type="button" className={btn.icon} aria-label={`Rename ${p.title}`} onClick={() => setRenaming({ id: p.id, title: p.title })}>
                    <Pencil size={15} />
                  </button>
                  <button type="button" className={btn.icon} aria-label={`Delete ${p.title}`} onClick={() => library.deletePlaylist(p.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
                {expanded && (
                  <div className="px-2 pb-2">
                    {tracks.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-muted">Empty. Add tracks from the ••• menu.</p>
                    ) : (
                      <ul>
                        {tracks.map((t, i) => (
                          <TrackRow
                            key={t.id}
                            track={t}
                            index={i}
                            onPlay={() => player.playTracks(tracks, i, p.title)}
                            trailing={
                              <button type="button" className={btn.icon} aria-label={`Remove ${t.title} from ${p.title}`} onClick={() => library.removeFromPlaylist(p.id, t.id)}>
                                <X size={15} />
                              </button>
                            }
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function DataControls() {
  const auth = useAuth();
  const toast = useToast();
  const [confirming, setConfirming] = useState<"all" | "account" | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (scope: "all" | "account") => {
    setBusy(true);
    try {
      if (auth.user) {
        const token = await auth.accessToken();
        const res = await fetch(`/api/user/data?scope=${scope}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.message ?? "Couldn't delete your data.");
        library.clearLocal();
        if (scope === "account") await auth.signOut();
        toast(body.message ?? (scope === "account" ? "Your account and data were deleted." : "Your data was deleted."));
      } else {
        library.clearLocal();
        toast("Everything saved in this browser was cleared.");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't delete your data.", "error");
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  };

  return (
    <Section id="data" title="Privacy & your data">
      <p className="max-w-2xl text-sm leading-relaxed text-muted">
        What you write is used to pick music and then discarded. It&rsquo;s only kept if you save a journal entry and tick &ldquo;include what I
        wrote&rdquo;. <Link href="/privacy" className="text-ink underline underline-offset-4">Read the full privacy notice</Link>.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        {confirming ? (
          <div role="alertdialog" aria-label="Confirm deletion" className="flex flex-wrap items-center gap-3 rounded-2xl bg-danger/10 p-4 ring-1 ring-danger/25">
            <p className="text-sm text-ink">
              {confirming === "account"
                ? "Delete your account and everything in it? This can't be undone."
                : auth.user
                  ? "Delete all favourites, playlists, history and mood entries from your account? This can't be undone."
                  : "Clear everything saved in this browser? This can't be undone."}
            </p>
            <button type="button" disabled={busy} onClick={() => run(confirming)} className="rounded-full bg-danger px-4 py-2 text-sm font-semibold text-bg disabled:opacity-50">
              Yes, delete
            </button>
            <button type="button" onClick={() => setConfirming(null)} className={btn.ghost}>Cancel</button>
          </div>
        ) : (
          <>
            <button type="button" onClick={() => setConfirming("all")} className={cn(btn.secondary, "text-danger")}>
              <Trash2 size={15} /> {auth.user ? "Delete all my data" : "Clear this browser's data"}
            </button>
            {auth.user && (
              <button type="button" onClick={() => setConfirming("account")} className={cn(btn.secondary, "text-danger")}>
                Delete my account
              </button>
            )}
          </>
        )}
      </div>
    </Section>
  );
}

export function ProfileView() {
  const lib = useLibrary();
  const player = usePlayer();
  const favourites = useMemo(() => getTracks(lib.favourites), [lib.favourites]);
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const ids = lib.history.map((h) => h.trackId).filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
    return getTracks(ids).slice(0, 12);
  }, [lib.history]);

  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 md:pt-12">
      <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted">Your library</p>
      <h1 className="font-display mt-4 text-[clamp(2.4rem,6vw,4rem)] leading-[1.02]">
        {lib.prefs.displayName ? `Hi, ${lib.prefs.displayName}.` : "Everything you've kept."}
      </h1>

      <div className="mt-10 space-y-6">
        <Section id="account" title="Account">
          <Account />
        </Section>

        <Section
          id="favourites"
          title="Favourites"
          action={favourites.length > 0 && (
            <button type="button" className={btn.secondary} onClick={() => player.playTracks(favourites, 0, "Favourites")}>
              <Play size={15} fill="currentColor" /> Play all
            </button>
          )}
        >
          {favourites.length === 0 ? (
            <Empty>Tap the heart on any track to keep it here.</Empty>
          ) : (
            <ul>
              {favourites.map((t, i) => (
                <TrackRow key={t.id} track={t} index={i} onPlay={() => player.playTracks(favourites, i, "Favourites")} />
              ))}
            </ul>
          )}
        </Section>

        <Playlists />

        <Section id="recent" title="Recently played">
          {recent.length === 0 ? (
            <Empty>Tracks you listen to for at least 30 seconds show up here.</Empty>
          ) : (
            <ul>
              {recent.map((t, i) => (
                <TrackRow key={t.id} track={t} index={i} onPlay={() => player.playTracks(recent, i, "Recently played")} />
              ))}
            </ul>
          )}
        </Section>

        <Section id="preferences" title="Preferences">
          <div className="grid gap-8 md:grid-cols-2">
            <fieldset>
              <legend className="mb-3 text-sm text-muted">Vocals in recommendations</legend>
              <div className="flex flex-wrap gap-2">
                {(["any", "instrumental", "vocal"] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={lib.prefs.vocals === v} onClick={() => library.updatePrefs({ vocals: v })} className={cn(btn.chip, "capitalize", chipState(lib.prefs.vocals === v))}>
                    {v === "any" ? "No preference" : v}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="md:col-span-2">
              <legend className="mb-3 text-sm text-muted">Genres you like (gently favoured in recommendations)</legend>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g) => {
                  const on = lib.prefs.genres.includes(g);
                  return (
                    <button key={g} type="button" aria-pressed={on} onClick={() => library.updatePrefs({ genres: on ? lib.prefs.genres.filter((x) => x !== g) : [...lib.prefs.genres, g] })} className={cn(btn.chip, chipState(on))}>
                      {g}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <label className="flex items-start gap-3 md:col-span-2">
              <input type="checkbox" checked={lib.prefs.journal} onChange={(e) => library.updatePrefs({ journal: e.target.checked })} className="mt-1 h-4 w-4 accent-[var(--atmo-accent)]" />
              <span>
                <span className="font-medium">Keep a mood journal</span>
                <span className="block text-sm text-muted">Saves the mood and intensity from each check-in (not your words, unless you choose to). Off by default.</span>
              </span>
            </label>
          </div>
        </Section>

        {(lib.prefs.journal || lib.moods.length > 0) && (
          <Section
            id="moods"
            title="Mood history"
            action={lib.moods.length > 0 && (
              <button type="button" className={cn(btn.ghost, "text-danger")} onClick={() => library.clearMoods()}>
                <Trash2 size={15} /> Delete all entries
              </button>
            )}
          >
            {lib.moods.length === 0 ? (
              <Empty>Your next check-in will appear here.</Empty>
            ) : (
              <ul className="divide-y divide-hairline">
                {lib.moods.map((m) => (
                  <li key={m.id} className="flex items-start gap-4 py-3">
                    <MoodOrb mood={m.primaryEmotion} className="mt-0.5 h-8 w-8" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {EMOTION_INFO[m.primaryEmotion].label} <span className="text-muted">· {Math.round(m.intensity * 100)}%</span>
                      </p>
                      <p className="text-xs text-faint">
                        {new Date(m.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                        {m.secondaryEmotions.length > 0 && ` · with ${m.secondaryEmotions.map((s) => EMOTION_INFO[s].short).join(", ")}`}
                      </p>
                      {m.note && <p className="mt-2 text-sm italic text-muted">&ldquo;{m.note}&rdquo;</p>}
                    </div>
                    <button type="button" className={btn.icon} aria-label="Delete this entry" onClick={() => library.deleteMood(m.id)}>
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        <DataControls />
      </div>
    </div>
  );
}
