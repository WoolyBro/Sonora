/**
 * Browser-side wrapper around the emotion worker. Lazily spins the worker up
 * the first time it's needed, so visitors who never use on-device analysis
 * never download the model or the runtime.
 */
import { MODEL_CONFIG } from "./model-config";
import { buildAnalysis } from "./normalize";
import type { EmotionAnalysis } from "./types";

export interface LoadProgress {
  progress: number; // 0–100
  loaded: number;
  total: number;
}

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();
const progressListeners = new Set<(p: LoadProgress) => void>();
let availability: Promise<boolean> | null = null;
let ready = false;

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./emotion.worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (event: MessageEvent) => {
    const msg = event.data;
    if (msg.type === "progress") {
      progressListeners.forEach((fn) => fn(msg));
      return;
    }
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.type === "error") entry.reject(new Error(msg.message));
    else entry.resolve(msg);
  };
  worker.onerror = (event) => {
    const err = new Error(event.message || "Emotion worker crashed");
    pending.forEach((p) => p.reject(err));
    pending.clear();
    worker?.terminate();
    worker = null;
    ready = false;
  };
  return worker;
}

function call<T>(type: "load" | "analyze", text?: string): Promise<T> {
  const id = ++seq;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    getWorker().postMessage({ id, type, text });
  });
}

/** Whether the model files are actually reachable (checked once per session). */
export function isOnDeviceAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || typeof Worker === "undefined") return Promise.resolve(false);
  // "no-cache" revalidates with the server (cheap: ETag). Never "force-cache":
  // a 404 stored before the model was deployed would otherwise be reused forever.
  availability ??= fetch(MODEL_CONFIG.metaUrl, { method: "GET", cache: "no-cache" })
    .then((r) => r.ok)
    .catch(() => false)
    .then((ok) => {
      if (!ok) availability = null; // check again next time (e.g. after reconnecting)
      return ok;
    });
  return availability;
}

export function isOnDeviceReady(): boolean {
  return ready;
}

export async function loadOnDeviceModel(onProgress?: (p: LoadProgress) => void): Promise<void> {
  if (onProgress) progressListeners.add(onProgress);
  try {
    await call("load");
    ready = true;
  } finally {
    if (onProgress) progressListeners.delete(onProgress);
  }
}

export async function analyzeOnDevice(
  text: string,
  onProgress?: (p: LoadProgress) => void,
  onRunning?: () => void,
): Promise<EmotionAnalysis> {
  if (!ready) await loadOnDeviceModel(onProgress);
  onRunning?.();
  const { scores } = await call<{ scores: Record<string, number> }>("analyze", text);
  return buildAnalysis({ text, scores, source: "on-device" });
}
