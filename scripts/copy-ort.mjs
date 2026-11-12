// Copies the onnxruntime-web WASM runtime into public/ort so the on-device
// emotion model never has to fetch code from a third-party CDN.
// Runs automatically on `npm install` (postinstall).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "onnxruntime-web", "dist");
const dest = join(root, "public", "ort");

if (!existsSync(src)) {
  console.warn("[copy-ort] onnxruntime-web not installed; skipping");
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
for (const file of ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) {
  copyFileSync(join(src, file), join(dest, file));
}
console.log("[copy-ort] copied runtime to public/ort");
