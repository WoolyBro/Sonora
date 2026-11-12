/// <reference lib="webworker" />
/**
 * Runs Sonora's own emotion classifier (DistilRoBERTa fine-tuned in the
 * emotion-music-ai project, exported to int8 ONNX) off the main thread.
 * The text never leaves the device.
 */
import { AutoModelForSequenceClassification, AutoTokenizer, env } from "@huggingface/transformers";

import { MODEL_CONFIG } from "./model-config";

type Loaded = {
  tokenizer: Awaited<ReturnType<typeof AutoTokenizer.from_pretrained>>;
  model: Awaited<ReturnType<typeof AutoModelForSequenceClassification.from_pretrained>>;
  headOrder: string[];
  masked: Set<string>;
  maxLen: number;
};

let loading: Promise<Loaded> | null = null;

function configure() {
  env.allowLocalModels = MODEL_CONFIG.host === "local";
  env.allowRemoteModels = MODEL_CONFIG.host === "hub";
  env.localModelPath = MODEL_CONFIG.localPath;
  const wasm = env.backends.onnx.wasm;
  if (wasm) {
    wasm.wasmPaths = { mjs: "/ort/ort-wasm-simd-threaded.mjs", wasm: "/ort/ort-wasm-simd-threaded.wasm" };
    wasm.numThreads = 1; // no cross-origin isolation required
  }
}

async function load(): Promise<Loaded> {
  configure();
  const progress_callback = (info: { status: string; progress?: number; loaded?: number; total?: number }) => {
    if (info.status === "progress_total") {
      postMessage({ type: "progress", progress: info.progress ?? 0, loaded: info.loaded ?? 0, total: info.total ?? 0 });
    }
  };
  const metaRes = await fetch(MODEL_CONFIG.metaUrl);
  if (!metaRes.ok) throw new Error(`model metadata unavailable (${metaRes.status})`);
  const meta = await metaRes.json();

  const [tokenizer, model] = await Promise.all([
    AutoTokenizer.from_pretrained(MODEL_CONFIG.modelId, { progress_callback }),
    AutoModelForSequenceClassification.from_pretrained(MODEL_CONFIG.modelId, {
      dtype: "q8",
      device: "wasm",
      progress_callback,
    }),
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
