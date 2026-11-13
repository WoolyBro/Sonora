/// <reference lib="webworker" />
/**
 * Runs Sonora's own emotion classifier (DistilRoBERTa fine-tuned in the
 * emotion-music-ai project, exported to int8 ONNX) off the main thread.
 * The text never leaves the device.
 *
 * Sonora downloads the model files itself (see `modelFetch`) instead of letting
 * transformers.js do it. CDNs such as Vercel compress large files on the fly and
 * drop Content-Length; transformers.js then starts a second full download of the
 * 83 MB model just to learn its size, and two parallel downloads of the same file
 * over one HTTP/2 connection fail with "network error". Here every file is fetched
 * exactly once, its size comes from sonora_meta.json, and it's cached by hash.
 */
import { AutoModelForSequenceClassification, AutoTokenizer, env } from "@huggingface/transformers";

import { MODEL_CONFIG } from "./model-config";

type FileInfo = { bytes: number; sha256: string };
type Meta = {
  head_order: string[];
  masked_heads?: string[];
  max_len?: number;
  files?: Record<string, FileInfo>;
};
type Loaded = {
  tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>;
  model: Awaited<ReturnType<typeof AutoModelForSequenceClassification.from_pretrained>>;
  headOrder: string[];
  masked: Set<string>;
  maxLen: number;
};
type Fetched = { status: number; bytes: Uint8Array | null; type: string };

const CACHE_NAME = "sonora-model";
const base = new URL(MODEL_CONFIG.baseUrl, self.location.href).href;

let meta: Meta | null = null;
let loading: Promise<Loaded> | null = null;
const downloads = new Map<string, Promise<Fetched>>();
const progress = { loaded: 0, total: 0 };

function reportProgress() {
  const { loaded, total } = progress;
  postMessage({ type: "progress", progress: total ? Math.min(100, (loaded / total) * 100) : 0, loaded, total });
}

async function openCache(): Promise<Cache | null> {
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null; // private mode, storage disabled, etc.: just don't cache
  }
}

/** Download one model file, exactly once per session, with progress and a hash-keyed cache. */
async function download(url: string): Promise<Fetched> {
  const name = url.slice(base.length);
  const info = meta?.files?.[name];
  const cacheKey = info ? `${url}?sha256=${info.sha256}` : null;
  const cache = cacheKey ? await openCache() : null;

  const hit = cacheKey ? await cache?.match(cacheKey).catch(() => undefined) : undefined;
  if (hit) {
    const bytes = new Uint8Array(await hit.arrayBuffer());
    progress.loaded += bytes.length;
    reportProgress();
    return { status: 200, bytes, type: hit.headers.get("content-type") ?? "application/octet-stream" };
  }

  const res = await fetch(url, { cache: "no-cache" });
  const type = res.headers.get("content-type") ?? "application/octet-stream";
  if (!res.ok || !res.body) return { status: res.status, bytes: null, type };

  // Size: from our manifest, else the header (absent when the CDN compresses).
  const expected = info?.bytes ?? (Number(res.headers.get("content-length")) || 0);
  if (!info && expected) {
    progress.total += expected;
  }
  let buffer = new Uint8Array(expected || 1 << 20);
  let offset = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (offset + value.length > buffer.length) {
      const grown = new Uint8Array(Math.max(buffer.length * 2, offset + value.length));
      grown.set(buffer.subarray(0, offset));
      buffer = grown;
    }
    buffer.set(value, offset);
    offset += value.length;
    progress.loaded += value.length;
    reportProgress();
  }
  const bytes = offset === buffer.length ? buffer : buffer.slice(0, offset);
  if (info && bytes.length !== info.bytes) {
    throw new Error(`${name}: expected ${info.bytes} bytes, received ${bytes.length}`);
  }
  if (cacheKey && cache) {
    await cache
      .put(cacheKey, new Response(bytes, { headers: { "content-type": type, "content-length": String(bytes.length) } }))
      .catch(() => {}); // quota exceeded: fine, it'll download again next visit
  }
  return { status: 200, bytes, type };
}

/** A Response that hands over `bytes` without copying until someone reads it. */
function bytesResponse({ status, bytes, type }: Fetched): Response {
  if (!bytes) return new Response(null, { status, headers: { "content-type": type } });
  let sent = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent) controller.close();
      else {
        controller.enqueue(bytes);
        sent = true;
      }
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": type, "content-length": String(bytes.length) } });
}

/** transformers.js routes every request through env.fetch; model files go through `download`. */
const modelFetch: typeof fetch = async (input, init) => {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw, self.location.href);
  url.search = "";
  if (!url.href.startsWith(base)) return fetch(input, init);
  let job = downloads.get(url.href);
  if (!job) {
    job = download(url.href);
    downloads.set(url.href, job);
    job.catch(() => downloads.delete(url.href)); // allow a retry after a network failure
  }
  return bytesResponse(await job);
};

function configure() {
  env.allowLocalModels = MODEL_CONFIG.host === "local";
  env.allowRemoteModels = MODEL_CONFIG.host === "hub";
  env.localModelPath = MODEL_CONFIG.localPath;
  env.useBrowserCache = false; // we cache by content hash ourselves
  env.fetch = modelFetch;
  const wasm = env.backends.onnx.wasm;
  if (wasm) {
    wasm.wasmPaths = { mjs: "/ort/ort-wasm-simd-threaded.mjs", wasm: "/ort/ort-wasm-simd-threaded.wasm" };
    wasm.numThreads = 1; // no cross-origin isolation required
  }
}

async function load(): Promise<Loaded> {
  configure();
  const metaRes = await fetch(MODEL_CONFIG.metaUrl, { cache: "no-cache" });
  if (!metaRes.ok) throw new Error(`model metadata unavailable (${metaRes.status})`);
  meta = (await metaRes.json()) as Meta;

  // Known sizes up front so the progress bar is honest from the first byte.
  progress.loaded = 0;
  progress.total = Object.entries(meta.files ?? {})
    .filter(([name]) => name.startsWith("onnx/") || name.endsWith(".json"))
    .reduce((sum, [, f]) => sum + f.bytes, 0);
  reportProgress();

  const [tokenizer, model] = await Promise.all([
    AutoTokenizer.from_pretrained(MODEL_CONFIG.modelId),
    AutoModelForSequenceClassification.from_pretrained(MODEL_CONFIG.modelId, { dtype: "q8", device: "wasm" }),
  ]);
  return {
    tokenizer,
    model,
    headOrder: meta.head_order,
    masked: new Set(meta.masked_heads ?? []),
    maxLen: meta.max_len ?? 128,
  };
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

self.onmessage = async (event: MessageEvent<{ id: number; type: "load" | "analyze"; text?: string }>) => {
  const { id, type, text } = event.data;
  try {
    loading ??= load();
    const m = await loading;
    if (type === "load") {
      postMessage({ id, type: "ready" });
      return;
    }
    const inputs = await m.tokenizer(text ?? "", { truncation: true, max_length: m.maxLen });
    const output = await m.model(inputs);
    const logits = Array.from(output.logits.data as Float32Array);
    const scores: Record<string, number> = {};
    m.headOrder.forEach((label, i) => {
      // Heads that never received training data are placeholders, not measurements.
      scores[label] = m.masked.has(label) ? 0 : sigmoid(logits[i]);
    });
    postMessage({ id, type: "result", scores });
  } catch (err) {
    loading = null; // allow a retry after a network failure
    postMessage({ id, type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
