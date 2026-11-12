export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export const btn = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-bg transition hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-full bg-surface-strong px-5 py-2.5 text-sm font-medium text-ink ring-1 ring-hairline transition hover:bg-white/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-muted transition hover:bg-white/5 hover:text-ink disabled:opacity-40",
  icon:
    "inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-white/8 hover:text-ink disabled:cursor-not-allowed disabled:opacity-30",
  chip:
    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm ring-1 transition",
};

export const chipState = (active: boolean) =>
  active
    ? "bg-[color-mix(in_oklab,var(--atmo-accent)_22%,transparent)] text-ink ring-[color-mix(in_oklab,var(--atmo-accent)_60%,transparent)]"
    : "bg-surface text-muted ring-hairline hover:text-ink hover:bg-white/6";
