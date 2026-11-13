/**
 * Pre-computed spectrum data for the player's visuals (see
 * scripts/analyze_audio.py): 16 frequency bands + loudness, 15 frames a
 * second, stored next to each audio file as <name>.viz.json.
 */
export interface Viz {
  fps: number;
  bands: number;
  stride: number;
  frames: number;
  data: Uint8Array;
}

const cache = new Map<string, Promise<Viz | null>>();

/** Only same-origin files have analysis; remote tracks fall back to generic motion. */
export function vizUrl(audio: string): string | null {
  if (!audio.startsWith("/")) return null;
  return audio.replace(/\.[a-z0-9]+$/i, ".viz.json");
}

export function loadViz(audio: string): Promise<Viz | null> {
  const url = vizUrl(audio);
  if (!url) return Promise.resolve(null);
  let job = cache.get(url);
  if (!job) {
    job = fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.data) return null;
        const bin = atob(j.data);
        const data = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
        return { fps: j.fps, bands: j.bands, stride: j.stride, frames: j.frames, data } satisfies Viz;
      })
      .catch(() => null);
    cache.set(url, job);
  }
  return job;
}

/** Writes bands (0..1) into `out[0..bands)` and loudness into `out[bands]`, interpolated at time t. */
export function sampleViz(viz: Viz, t: number, out: Float32Array): void {
  const f = Math.max(0, t * viz.fps);
  const i = Math.min(viz.frames - 1, Math.floor(f));
  const j = Math.min(viz.frames - 1, i + 1);
  const a = f - Math.floor(f);
  for (let b = 0; b < viz.stride; b++) {
    out[b] = (viz.data[i * viz.stride + b] * (1 - a) + viz.data[j * viz.stride + b] * a) / 255;
  }
}
