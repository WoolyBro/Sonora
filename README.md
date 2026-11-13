# Sonora

> Feel something. Put it into words. Let Sonora find your sound.

Sonora reads how you feel from a few words with **its own emotion model, trained for this project and run in the browser** (no ChatGPT, Claude or other third-party AI), estimates the emotions and their intensity, and recommends music in three listening directions: music that meets your mood, music that gently shifts it, and something different. It's a listening experience, not a mental-health service.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion · Lucide · transformers.js (ONNX, in-browser) · Supabase (optional) · Vitest.

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
| **Library** (`/profile`) | Guest mode or magic-link sign-in; display name, favourites, playlists, recently played, preferences (vocals, genres), optional mood journal, delete entries/data/account. |
| **Privacy** (`/privacy`) | Plain-language notice. Raw text is never stored by default. |

### Sample content (please read)

The 26 tracks in `public/audio/` are **original sketches synthesised by `scripts/generate_sample_audio.py`** from each track's catalogue metadata (tempo, energy, valence, instrumentation). They exist so every feature works end to end, and they're marked `isSample: true` and badged "Sample" in the UI. They're license-free placeholders, not finished songs. Sonora does **not** generate music on request.

---

## Architecture

```
src/
  app/                    routes (pages + API route handlers)
    api/recommendations   POST profile → meet / shift / explore
    api/tracks[/id]       catalogue (+ filters)    api/collections
    api/favourites        auth'd (Supabase JWT)    api/user/history · api/user/data
  components/             layout · landing · emotion · player · music · discovery · profile · ui
  lib/
    emotion/              taxonomy · normalize · emotion.worker + onDevice (browser) · client
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

Check-ins are read **only by Sonora's own model**. No third-party AI service (ChatGPT, Claude, etc.) is involved, and the text never reaches any server.

1. **Sonora's own classifier in the browser.** This is the DistilRoBERTa model trained in the sibling `emotion-music-ai` project (`emotion_classifier_v2_v3`), exported to **int8 ONNX (83 MB, down from 313 MB)** and run with transformers.js in a Web Worker. The text never leaves the device. The export script verifies the quantised model against the original. On the 197-message hand-written check-in set, both pick the right top emotion for **112/197 (57%)**. Known gaps, shown in the UI: the *Numb / Disconnected* head had no training data and is forced to 0, and scores run high, so confidence is labelled as a hint.
   The model checkpoint was chosen from the eight trained in `emotion-music-ai/models/` because it scored best on the held-out check-in test set (62/100 top-1, vs 59/100 for `emotion_classifier_v2_stress_v1_resume`). The download starts in the background as soon as the listener begins typing, and the browser caches it afterwards.
2. **Honest failure.** If the model can't load, the user is asked to pick a mood. Sonora never fabricates a reading.

Shared post-processing (`normalize.ts`) applies the same rules whatever ran: secondary emotions (≥ 0.35 and ≥ half the primary, max 2), a *mixed* flag, an *uncertain* flag (no signal, low confidence, very short text) that switches the UI to "closest guess", and a self-harm phrase check that shows support resources. Intensity is estimated from the model's signal strength plus intensity words and labelled as such. Users can always correct mood and intensity.

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

- The only secret is `SUPABASE_SERVICE_ROLE_KEY`, which is server-only and never reaches the browser (checked against the build output).
- Every endpoint is validated with Zod (strict objects, length limits). Errors are safe: no stack traces or upstream details.
- User endpoints authenticate with the user's Supabase JWT, and queries run under RLS. The service-role key is used only to delete the auth user on account deletion.
- The ONNX runtime is self-hosted (`public/ort`), so on-device analysis makes no third-party CDN requests.
- No medical claims, diagnoses or inferred sensitive attributes. Support resources appear when self-harm is mentioned.

---

## Getting started

### Prerequisites

- Node.js ≥ 20.9 and npm
- *(optional)* a Supabase project for accounts
- *(optional, to regenerate assets)* Python 3.10+ with `torch transformers onnx onnxruntime onnxscript numpy lameenc`

### Install and run

```bash
npm install            # also copies the ONNX runtime into public/ort
cp .env.example .env.local
npm run dev            # http://localhost:3000
```

With no env vars at all, Sonora runs in guest mode with its emotion model, the full player and the library.

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_EMOTION_MODEL_HOST` | client | `local` (default, `public/models/<id>`) or `hub` (Hugging Face Hub). |
| `NEXT_PUBLIC_EMOTION_MODEL_ID` | client | `sonora-emotion` (local folder name) or `your-name/sonora-emotion` (Hub repo). |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client | Enables accounts and sync. Safe to expose because RLS protects the data. |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Only for "Delete my account". Optional. |

### Emotion model (on-device)

The 83 MB model is **committed to the repo** in `public/models/sonora-emotion/`, so Vercel serves it straight from its CDN with no setup. (It's under GitHub's 100 MB per-file limit.) To regenerate it from a trained checkpoint:

```bash
python scripts/export_emotion_model.py \
  --model ../VS/Python/Music/emotion-music-ai/models/emotion_classifier_v2_v3 \
  --eval  ../VS/Python/Music/emotion-music-ai/data/annotations/checkin_eval_v1.csv \
  --out   public/models/sonora-emotion
```

It writes the ONNX model, tokenizer, `sonora_meta.json` (label order, masked heads, thresholds) and `export_report.json` (size and agreement with the fp32 model).

After retraining, re-run the export and commit the new files. Optionally, you can host it on the Hugging Face Hub instead (saves Vercel bandwidth): upload the *contents* of `public/models/sonora-emotion/` (keeping the `onnx/` folder) to a model repo, then set `NEXT_PUBLIC_EMOTION_MODEL_HOST=hub` and `NEXT_PUBLIC_EMOTION_MODEL_ID=<user>/<repo>`. If the new checkpoint trains the numbness head, `sonora_meta.json` picks that up automatically.

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
npm test          # Vitest: 64 tests
npm run lint      # ESLint (Next + React Compiler rules)
npm run typecheck # route typegen + tsc
npm run build     # production build
```

Coverage: supported labels, mixed emotions, intensity boundaries, uncertain/short input, the model → manual fallback (and that no server is ever called), and background model warm-up. Recommendations: mood matching, intensity compatibility, secondary emotions, both shift directions, MMR diversity, vocal preference, recency, empty catalogue and determinism. Catalogue: schema, audio files present and malformed catalogues rejected. Queue: shuffle, repeat, play-next, remove, reorder and empty. Player UI (jsdom): play/pause, track switching, seeking, volume and mute, shuffle and repeat, queue management, unavailable-audio state and end of queue. Library: guest persistence, journal opt-in, no raw text by default, deletions and broken storage. API routes: status codes and auth requirements.

Not automated: real Supabase sign-in/sync (needs a project). The emotion model itself was checked manually in a browser.

---

## Deploying to Vercel

1. Push the repo to GitHub, GitLab or Bitbucket.
2. In Vercel, choose **New Project** and import the repo. The framework is detected as Next.js. Keep the default build command (`next build`) and install command (`npm install`).
3. Add the environment variables from the table above (Production and Preview).
4. Deploy. Add the deployment URL to Supabase's redirect URLs if you use accounts.

Notes:

- The API routes are stateless functions. Emotion reading runs in the browser, so it costs no function time.
- Static assets (audio, ONNX runtime, emotion model) are served from Vercel's CDN. Only the current track streams. Each new visitor downloads the 83 MB model once; Vercel Hobby includes 100 GB/month of transfer.
- Check after deploying: `<your-url>/models/sonora-emotion/sonora_meta.json` should return JSON (not 404).

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Check-in says "Sonora's emotion model couldn't be loaded" | `public/models/sonora-emotion/` is missing from the deployment, or `NEXT_PUBLIC_EMOTION_MODEL_*` points somewhere else. |
| On-device model never finishes loading | Open DevTools → Network: `sonora_meta.json`, `onnx/model_quantized.onnx` and `/ort/*.wasm` must return 200. Run `npm install` to restore `public/ort`. |
| `401 invalid_session` / sign-in link does nothing | The Supabase Site URL or redirect URLs don't include this origin. |
| A track shows "isn't available right now" | Its `audio` path is wrong or the file is missing. `npm test` lists every missing file. |
| Blur/glass surfaces look flat | They need `backdrop-filter` support. The CSS deliberately routes it through `--glass-filter` (see `globals.css`). |

---

## Remaining limitations

- **Sample music.** The library is generated placeholder audio. Replace it with real, licensed or original tracks. There are no vocal tracks yet, so the vocal filter is empty.
- **On-device accuracy.** About 57% top-1 on in-domain check-ins, no numbness signal, overconfident probabilities. Readings are estimates the user can always correct. Training the numbness head and collecting more check-in data are the main ways to improve it.
- **Intensity** from the on-device path is a labelled heuristic, not a trained intensity model. There are no human-annotated intensity labels yet.
- **Accounts** use magic links only, and cross-device sync is last-write-wins with no conflict resolution.
- **Production check.** A Vercel deployment exists, but the emotion model's behaviour there should be re-checked after each deploy (see *Deploying to Vercel*).
