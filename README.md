# Sonora

> Feel something. Put it into words. Let Sonora find your sound.

Sonora reads how you feel from a few words, estimates the emotions and their intensity, and recommends music in three listening directions: music that meets your mood, music that gently shifts it, and something different. It's a listening experience, not a mental-health service.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion · Lucide · Claude API · transformers.js (ONNX, in-browser) · Supabase (optional) · Vitest.

---

## What's in the box

| Area | What works |
| --- | --- |
| **Landing** | Animated sound-wave hero, how it works, featured collections, care note, footer. |
| **Check-in** (`/experience`) | Free-text composer (character count, clear, ⌘/Ctrl+Enter, optional example prompts), manual mood picker, loading states, reading screen with primary emotion, fluid intensity meter, secondary signals, plain-language explanation, confidence details, and full correction (mood, mixed moods, intensity) before any music plays. |
| **Recommendations** | *Meet your mood*, *Shift your atmosphere* (calmer ⇄ brighter, user-switchable), *Explore something different*. Every pick shows why it was chosen. |
| **Player** | Real HTML audio: play/pause, previous/next, waveform seek bar (real peaks), times, volume, mute, shuffle, repeat (off/all/one), queue (play next, add, reorder, remove, clear), favourites, fade transitions, lock-screen/media keys, Space to toggle, error and unavailable states. Persistent bottom bar on desktop; mini player that expands to a full-screen, drag-to-dismiss player on mobile. |
| **Discover** (`/discover`) | 8 collections with generative artwork; search and filtering by mood, energy, vocal/instrumental, genre and collection. |
| **Sonora Originals** (`/originals`) | Originals with artwork, credits, mood tags, description, AI-assisted label and favourites. |
| **Library** (`/profile`) | Guest mode or magic-link sign-in; display name, favourites, playlists, recently played, preferences (vocals, genres, analysis mode), optional mood journal, delete entries/data/account. |
| **Privacy** (`/privacy`) | Plain-language notice. Raw text is never stored by default. |

### Sample content (please read)

The 26 tracks in `public/audio/` are **original sketches synthesised by `scripts/generate_sample_audio.py`** from each track's catalogue metadata (tempo, energy, valence, instrumentation). They exist so every feature works end to end, and they're marked `isSample: true` and badged "Sample" in the UI. They're license-free placeholders, not finished songs. Sonora does **not** generate music on request.

---

## Architecture

```
src/
  app/                    routes (pages + API route handlers)
    api/emotion/analyze   POST text → reading (Claude) · GET → is server analysis configured?
    api/recommendations   POST profile → meet / shift / explore
    api/tracks[/id]       catalogue (+ filters)    api/collections
    api/favourites        auth'd (Supabase JWT)    api/user/history · api/user/data
  components/             layout · landing · emotion · player · music · discovery · profile · ui
  lib/
    emotion/              taxonomy · normalize · claude (server) · emotion.worker + onDevice (browser) · client
    recommendations/      engine.ts (pure, deterministic)
    audio/                queue.ts (pure queue model) · format.ts
    library/              store (guest localStorage ⇄ Supabase write-through) · remote
    supabase/  server/  validation/  catalog.ts  search.ts
  data/                   catalog.json (hand-edited) · audio-manifest.json (generated)
scripts/                  export_emotion_model.py · generate_sample_audio.py · copy-ort.mjs
supabase/schema.sql       tables + Row Level Security
tests/                    Vitest unit + integration tests
```

Everything server-side is a stateless Vercel function. There's no persistent Python server.

### Emotion analysis

One taxonomy (`src/lib/emotion/taxonomy.ts`) drives everything: `LOW_SAD`, `ANXIOUS_WORRIED`, `ANGRY_FRUSTRATED`, `STRESSED_OVERWHELMED`, `NUMB_DISCONNECTED`, `POSITIVE_JOYFUL`, `AFFECTIONATE_CONNECTED`, `CALM_PEACEFUL`. Each state is scored **0–1 independently** (several can be high at once).

The client tries, in order:

1. **Claude on the server** (when `ANTHROPIC_API_KEY` is set). `claude-opus-5-5` with structured outputs (a Zod schema), low effort, server-side refusal fallback. It returns per-state scores, overall intensity, a "clarity" rating, an off-topic flag, a support flag and a one-sentence second-person explanation. The prompt forbids diagnoses and treats the text as data. The text is not logged or stored.
2. **Sonora's own classifier in the browser.** This is the DistilRoBERTa model trained in the sibling `emotion-music-ai` project (`emotion_classifier_v2_v3`), exported to **int8 ONNX (83 MB, down from 313 MB)** and run with transformers.js in a Web Worker. The text never leaves the device. The export script verifies the quantised model against the original. On the 197-message hand-written check-in set, both pick the right top emotion for **112/197 (57%)**. Known gaps, shown in the UI: the *Numb / Disconnected* head had no training data and is forced to 0, and scores run high, so confidence is labelled as a hint.
3. **Honest failure.** If neither is available, the user is asked to pick a mood. Sonora never fabricates a reading.

Shared post-processing (`normalize.ts`) applies the same rules whatever ran: secondary emotions (≥ 0.35 and ≥ half the primary, max 2), a *mixed* flag, an *uncertain* flag (no signal, off-topic, low confidence, very short text) that switches the UI to "closest guess", and a self-harm phrase check that shows support resources. Where a model doesn't produce intensity (the on-device model), it's estimated from signal strength plus intensity words and labelled as such. Users can always correct mood and intensity.

### Recommendation algorithm (`src/lib/recommendations/engine.ts`)

Pure and deterministic. There's no randomness and no sad→slow, happy→fast mapping.

- Each emotion has a point on the valence/arousal plane (circumplex model). The listener's **target** is the score-weighted centroid of their emotions, scaled by **intensity** (a mild feeling sits near neutral, a strong one further out).
- Tracks sit on the same plane via catalogue `valence` and `energy`, plus mood tags and an `intensityRange`.
- **Meet your mood** = 0.42 · cosine(listener emotion vector, track mood tags; secondary tags count) + 0.33 · closeness to target + 0.15 · intensity compatibility + 0.10 · preferences − recency penalty.
- **Shift your atmosphere** moves the target *calmer* (−arousal, +valence) or *brighter* (+valence, +arousal). The default depends on where you are, and you can flip it. Tracks heading the wrong way are penalised.
- **Explore something different** uses maximal marginal relevance, so picks stay relevant but vary in genre, mood and collection.
- Vocal preference is a hard filter, relaxed only if it leaves too few tracks (and the UI says so). Liked genres and favourites get a gentle boost. Recently played tracks drop down.
- `POST /api/recommendations` runs it on the server. The client falls back to the same engine locally if the request fails (offline).

### Player

`lib/audio/queue.ts` is a pure queue model (shuffle keeps the current track, repeat one/all, play next, reorder, remove), so it's fully unit-tested. `PlayerProvider` drives a single `<audio>` element. Only the current track's metadata is preloaded, never the whole library. It adds fade-out/fade-in track transitions, media-session integration, and history logging after 30 s (or half the track). Time updates live in a separate context, so only the seek bar re-renders four times a second. A track whose file fails shows "This track isn't available right now" with a retry. It doesn't pretend to play.

### Data model and persistence

Guests: favourites, playlists, history, preferences and the optional mood journal are saved in `localStorage`. Signed in (Supabase magic link): the same data is written through to Postgres and merged with anything saved as a guest. Signing out wipes the local copy.

`supabase/schema.sql` creates `profiles`, `favourites`, `playlists`, `playlist_tracks`, `listening_history` and `mood_entries`, each with **Row Level Security** limiting every row to its owner. `mood_entries.note` (the user's own words) is null unless they tick "include what I wrote". Tracks live in `catalog.json`, so `track_id` is a slug.

### Security and privacy

- Secrets are server-only: `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` never reach the browser (checked against the build output).
- Every endpoint is validated with Zod (strict objects, length limits). Errors are safe: no stack traces or upstream details.
- `/api/emotion/analyze` is rate-limited to 10 requests/min per IP. This is in-memory, so it's per serverless instance. For a hard global limit, back `src/lib/server/rate-limit.ts` with Upstash Redis or Vercel KV.
- User endpoints authenticate with the user's Supabase JWT, and queries run under RLS. The service-role key is used only to delete the auth user on account deletion.
- The ONNX runtime is self-hosted (`public/ort`), so on-device analysis makes no third-party CDN requests.
- No medical claims, diagnoses or inferred sensitive attributes. Support resources appear when self-harm is mentioned.

---

## Getting started

### Prerequisites

- Node.js ≥ 20.9 and npm
- *(optional)* an Anthropic API key from [console.anthropic.com](https://console.anthropic.com). This is pay-as-you-go API access, which a Claude Pro/Max subscription doesn't include.
- *(optional)* a Supabase project for accounts
- *(optional, to regenerate assets)* Python 3.10+ with `torch transformers onnx onnxruntime onnxscript numpy lameenc`

### Install and run

```bash
npm install            # also copies the ONNX runtime into public/ort
cp .env.example .env.local
npm run dev            # http://localhost:3000
```

With no env vars at all, Sonora runs in guest mode with on-device analysis (if the model is present, see below) and the full player and library.

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | server | Enables Claude analysis. Unset → on-device/manual. |
| `ANTHROPIC_MODEL` | server | Optional override (default `claude-opus-5-5`). |
| `NEXT_PUBLIC_EMOTION_MODEL_HOST` | client | `local` (default, `public/models/<id>`) or `hub` (Hugging Face Hub). |
| `NEXT_PUBLIC_EMOTION_MODEL_ID` | client | `sonora-emotion` (local folder name) or `your-name/sonora-emotion` (Hub repo). |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Enables accounts and sync. Safe to expose because RLS protects the data. |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Only for "Delete my account". Optional. |

### Emotion model (on-device)

The 83 MB model is **git-ignored** (`public/models/`), so it isn't committed by accident. Generate it from your trained checkpoint:

```bash
python scripts/export_emotion_model.py \
  --model ../VS/Python/Music/emotion-music-ai/models/emotion_classifier_v2_v3 \
  --eval  ../VS/Python/Music/emotion-music-ai/data/annotations/checkin_eval_v1.csv \
  --out   public/models/sonora-emotion
```

It writes the ONNX model, tokenizer, `sonora_meta.json` (label order, masked heads, thresholds) and `export_report.json` (size and agreement with the fp32 model).

**For production**, host it on the Hugging Face Hub: create a model repo, upload the *contents* of `public/models/sonora-emotion/` (keeping the `onnx/` folder), then set `NEXT_PUBLIC_EMOTION_MODEL_HOST=hub` and `NEXT_PUBLIC_EMOTION_MODEL_ID=<user>/<repo>`. Alternatively commit it with Git LFS and remove the `.gitignore` line. After retraining, re-run the export. If the new checkpoint trains the numbness head, `sonora_meta.json` picks that up automatically.

### Music catalogue

Everything lives in `src/data/catalog.json` and is validated at build time (bad moods, dangling collection references or duplicate ids fail the build and the tests). To add a track:

1. Put the audio in `public/audio/` (mp3/ogg/wav), or use any absolute URL.
2. Add an entry to `tracks`: `id` (slug), `title`, `artist`, `album`, `audio`, optional `artwork` (path or URL; falls back to generative art), `primaryMood`, `secondaryMoods`, `energy` and `valence` (0–1), `tempo`, `bpm`, `genre`, `instrumentation`, `vocals` (`instrumental`/`vocal`), `intensityRange` ([min, max] intensity it suits), `description`, `isOriginal`, `isSample: false`, `aiAssisted`, `credits`.
3. Add its id to one or more `collections[].trackIds`.

Durations and waveforms for real tracks are read from the file at play time. Precomputed peaks (`audio-manifest.json`) exist only for the generated samples. To regenerate the samples run `npm run audio:generate` (it never overwrites tracks with `isSample: false`).

### Supabase setup (optional)

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/schema.sql`.
3. Under Authentication → Providers, enable Email (magic link). Under Authentication → URL configuration, set the Site URL to your deployed URL and add `http://localhost:3000/**` and your Vercel URLs as redirect URLs.
4. Copy the project URL and anon key (and optionally the service-role key) into your env.

---

## Testing

```bash
npm test          # Vitest: 78 tests
npm run lint      # ESLint (Next + React Compiler rules)
npm run typecheck # route typegen + tsc
npm run build     # production build
```

Coverage: emotion request validation, supported labels, mixed emotions, intensity boundaries, uncertain/short/off-topic input, refusal/timeout/rate-limit handling and the server → on-device → manual fallback. Recommendations: mood matching, intensity compatibility, secondary emotions, both shift directions, MMR diversity, vocal preference, recency, empty catalogue and determinism. Catalogue: schema, audio files present and malformed catalogues rejected. Queue: shuffle, repeat, play-next, remove, reorder and empty. Player UI (jsdom): play/pause, track switching, seeking, volume and mute, shuffle and repeat, queue management, unavailable-audio state and end of queue. Library: guest persistence, journal opt-in, no raw text by default, deletions and broken storage. API routes: status codes, rate limiting and auth requirements.

Not automated: real Supabase sign-in/sync (needs a project) and real Claude calls (need a key). The on-device model was checked manually in a browser.

---

## Deploying to Vercel

1. Push the repo to GitHub, GitLab or Bitbucket.
2. In Vercel, choose **New Project** and import the repo. The framework is detected as Next.js. Keep the default build command (`next build`) and install command (`npm install`).
3. Add the environment variables from the table above (Production and Preview).
4. Make the on-device model reachable (Hugging Face Hub recommended, see above), or skip it and rely on Claude plus manual selection.
5. Deploy. Add the deployment URL to Supabase's redirect URLs if you use accounts.

Notes:

- The API routes are stateless functions. `/api/emotion/analyze` sets `maxDuration = 30`.
- Static assets (audio, ONNX runtime, model if self-hosted) are served from Vercel's CDN. Only the current track streams.
- Check after deploying: `GET /api/emotion/analyze` should return `{"serverAnalysis": true}` once the key is set.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Check-in says "Automatic reading isn't set up" | No `ANTHROPIC_API_KEY` and no reachable model. Add the key, or export/host the model and check `NEXT_PUBLIC_EMOTION_MODEL_*`. |
| On-device model never finishes loading | Open DevTools → Network: `sonora_meta.json`, `onnx/model_quantized.onnx` and `/ort/*.wasm` must return 200. Run `npm install` to restore `public/ort`. |
| `503 not_configured` from `/api/emotion/analyze` | Expected without a key. The client falls back automatically. |
| `401 invalid_session` / sign-in link does nothing | The Supabase Site URL or redirect URLs don't include this origin. |
| A track shows "isn't available right now" | Its `audio` path is wrong or the file is missing. `npm test` lists every missing file. |
| Blur/glass surfaces look flat | They need `backdrop-filter` support. The CSS deliberately routes it through `--glass-filter` (see `globals.css`). |

---

## Remaining limitations

- **Sample music.** The library is generated placeholder audio. Replace it with real, licensed or original tracks. There are no vocal tracks yet, so the vocal filter is empty.
- **On-device accuracy.** About 57% top-1 on in-domain check-ins, no numbness signal, overconfident probabilities. Claude analysis is the better default, and both are estimates the user can correct.
- **Intensity** from the on-device path is a labelled heuristic, not a trained intensity model. There are no human-annotated intensity labels yet.
- **Rate limiting** is per instance (in memory). Use Redis/KV for a global limit.
- **Accounts** use magic links only, and cross-device sync is last-write-wins with no conflict resolution.
- **Not yet verified in production.** It builds and runs locally, but no Vercel deployment has been made from this repo.
