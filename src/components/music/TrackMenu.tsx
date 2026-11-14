"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Ellipsis, ListEnd, ListPlus, Plus } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { usePlayer } from "@/components/player/PlayerProvider";
import { useToast } from "@/components/ui/Toaster";
import { btn, cn } from "@/components/ui/styles";
import { useLibrary } from "@/hooks/useLibrary";
import type { Track } from "@/lib/catalog";
import { library } from "@/lib/library/store";

export function TrackMenu({ track, align = "right" }: { track: Track; align?: "left" | "right" }) {
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const player = usePlayer();
  const { playlists } = useLibrary();
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Close when the page is hidden by a navigation (Activity keeps state otherwise).
  useLayoutEffect(() => () => setOpen(false), []);

  const close = () => {
    setOpen(false);
    setNaming(false);
    setName("");
  };

  const item = "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ink/90 hover:bg-ink/8";

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={btn.icon}
        aria-label={`More options for ${track.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        <Ellipsis size={18} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            className={cn(
              "glass absolute top-10 z-40 w-60 rounded-2xl p-1.5 shadow-2xl shadow-[rgb(42_32_78/0.16)] ring-1 ring-ink/10",
              align === "right" ? "right-0" : "left-0",
            )}
          >
            <button role="menuitem" className={item} onClick={() => { player.playNext(track); toast("Playing next"); close(); }}>
              <ListPlus size={16} /> Play next
            </button>
            <button role="menuitem" className={item} onClick={() => { player.enqueue(track); toast("Added to queue"); close(); }}>
              <ListEnd size={16} /> Add to queue
            </button>
            <div className="my-1 h-px bg-hairline" />
            <p className="px-3 pb-1 pt-1.5 text-xs uppercase tracking-wider text-faint">Add to playlist</p>
            <div className="max-h-40 overflow-y-auto">
              {playlists.map((p) => (
                <button
                  key={p.id}
                  role="menuitem"
                  className={item}
                  onClick={() => {
                    library.addToPlaylist(p.id, track.id);
                    toast(`Added to ${p.title}`);
                    close();
                  }}
                >
                  <span className="truncate">{p.title}</span>
                </button>
              ))}
            </div>
            {naming ? (
              <form
                className="flex gap-1.5 p-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const p = library.createPlaylist(name, [track.id]);
                  toast(`Created ${p.title}`);
                  close();
                }}
              >
                <input
                  autoFocus
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Playlist name"
                  aria-label="New playlist name"
                  className="min-w-0 flex-1 rounded-lg bg-ink/8 px-2.5 py-1.5 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-[var(--atmo-accent)]"
                />
                <button type="submit" className="rounded-lg bg-ink px-2.5 text-sm font-medium text-bg">Add</button>
              </form>
            ) : (
              <button role="menuitem" className={item} onClick={() => setNaming(true)}>
                <Plus size={16} /> New playlist
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
