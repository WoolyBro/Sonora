export function formatTime(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "–:––";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** Minimum listening time before a play counts toward history. */
export function playThreshold(duration: number | null): number {
  if (!duration || !Number.isFinite(duration)) return 30;
  return Math.min(30, duration * 0.5);
}
