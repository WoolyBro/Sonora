"""Import your own songs, sorted into mood / intensity folders, into Sonora.

Expected layout (folder names are matched loosely):

    Music Training Data/
      Anxious/
        Less than 0.25/      *.mp3   -> played for anxious readings below 25%
        Bw 0.25 and 0.5/     *.mp3   -> 25-50%
        Bw 0.5 to 0.75/      *.mp3   -> 50-75%
        Bw 0.75 to 1/        *.mp3   -> 75-100%
      Sad/ ...

The same file in several folders (same bytes) becomes ONE track that belongs to
each of those mood/intensity "placements". Titles, artist and cover art come
from the files' tags (falling back to the file name); lyrics, if present, mark
a track as vocal (they're never copied). Each file is analysed for duration,
waveform peaks, loudness and tempo.

Writes:
  public/audio/<id>.mp3, public/artwork/<id>.jpg
  src/data/my-songs.json            (tracks + one collection per mood)
  src/data/audio-manifest.json      (duration + peaks for these tracks)
Then run scripts/analyze_audio.py for the player's visualiser data.

Run:  training/.venv/bin/python scripts/import_songs.py ["/path/to/Music Training Data"]
      (needs numpy + mutagen; decoding uses macOS afconvert)
"""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import wave
from pathlib import Path

import numpy as np
from mutagen.id3 import ID3, ID3NoHeaderError

ROOT = Path(__file__).resolve().parent.parent
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.home() / "Desktop/Ideapad/Music Training Data"
AUDIO = ROOT / "public" / "audio"
ART = ROOT / "public" / "artwork"
OUT = ROOT / "src" / "data" / "my-songs.json"
MANIFEST = ROOT / "src" / "data" / "audio-manifest.json"

MOODS = {  # folder word -> (Sonora mood, label for copy)
    "sad": ("LOW_SAD", "sad"), "low": ("LOW_SAD", "low"),
    "anxious": ("ANXIOUS_WORRIED", "anxious"), "worried": ("ANXIOUS_WORRIED", "worried"),
    "angry": ("ANGRY_FRUSTRATED", "angry"), "frustrated": ("ANGRY_FRUSTRATED", "frustrated"),
    "stressed": ("STRESSED_OVERWHELMED", "stressed"), "overwhelmed": ("STRESSED_OVERWHELMED", "overwhelmed"),
    "numb": ("NUMB_DISCONNECTED", "numb"),
    "happy": ("POSITIVE_JOYFUL", "happy"), "joyful": ("POSITIVE_JOYFUL", "joyful"), "positive": ("POSITIVE_JOYFUL", "joyful"),
    "love": ("AFFECTIONATE_CONNECTED", "loved"), "connected": ("AFFECTIONATE_CONNECTED", "connected"),
    "affectionate": ("AFFECTIONATE_CONNECTED", "connected"),
    "calm": ("CALM_PEACEFUL", "calm"), "peaceful": ("CALM_PEACEFUL", "peaceful"),
}
MOOD_ORDER = ["LOW_SAD", "ANXIOUS_WORRIED", "ANGRY_FRUSTRATED", "STRESSED_OVERWHELMED",
              "NUMB_DISCONNECTED", "POSITIVE_JOYFUL", "AFFECTIONATE_CONNECTED", "CALM_PEACEFUL"]
COLLECTIONS = {  # mood -> (id, title, description, palette)
    "LOW_SAD": ("made-for-heavy-days", "Made for heavy days", "Your own songs for when things feel low, from barely-there to all-the-way-down.", ["#1d2a5c", "#2c3a78", "#4a3f7a"]),
    "ANXIOUS_WORRIED": ("made-for-anxious-moments", "Made for anxious moments", "Your own songs for a racing mind, chosen for how strong the worry feels.", ["#2a2f6b", "#4b3a7a", "#2f5a6b"]),
    "ANGRY_FRUSTRATED": ("made-for-hot-heads", "Made for hot heads", "Your own songs for frustration, sorted by how hot it runs.", ["#5a1f2a", "#7a3326", "#3b1f4a"]),
    "STRESSED_OVERWHELMED": ("made-for-full-plates", "Made for full plates", "Your own songs for pressure, sorted by how heavy it is.", ["#4a2a5a", "#6b3f3a", "#2a2f5a"]),
    "NUMB_DISCONNECTED": ("made-for-flat-days", "Made for flat days", "Your own songs for feeling far away.", ["#23263a", "#33364d", "#2a2d3f"]),
    "POSITIVE_JOYFUL": ("made-for-good-days", "Made for good days", "Your own songs for when things feel bright.", ["#6b3f2a", "#7a2f5a", "#4a2f7a"]),
    "AFFECTIONATE_CONNECTED": ("made-for-your-people", "Made for your people", "Your own songs for warmth and closeness.", ["#5a2440", "#7a3a4a", "#3f2a5a"]),
    "CALM_PEACEFUL": ("made-for-quiet", "Made for quiet", "Your own songs for stillness.", ["#173f45", "#1f3a5a", "#2a4a3f"]),
}


def parse_band(name: str) -> tuple[float, float] | None:
    nums = [float(x) for x in re.findall(r"\d*\.\d+|\d+", name)]
    nums = [n / 100 if n > 1 else n for n in nums]
    low = name.lower()
    if len(nums) >= 2:
        return (min(nums[:2]), max(nums[:2]))
    if len(nums) == 1:
        if any(w in low for w in ("less", "below", "under", "<")):
            return (0.0, nums[0])
        if any(w in low for w in ("more", "above", "over", ">")):
            return (nums[0], 1.0)
    return None


def slug(text: str) -> str:
    ascii_ = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_.lower()).strip("-")


def tidy_filename(stem: str) -> str:
    stem = re.sub(r"%2C", ",", re.sub(r"%3A", ":", stem))
    stem = re.sub(r"\s*\(\d+\)$", "", stem)
    if re.match(r"^(untitled song|aud-\d|new recording)", stem, re.I):
        return "Untitled"
    return re.sub(r"[-_]+", " ", stem).strip()


def decode(path: Path, sr: int = 22050) -> np.ndarray:
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "x.wav"
        subprocess.run(["afconvert", "-f", "WAVE", "-d", f"LEI16@{sr}", "-c", "1", str(path), str(out)], check=True)
        with wave.open(str(out)) as w:
            pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    return pcm.astype(np.float32) / 32768.0


def analyse(signal: np.ndarray, sr: int = 22050) -> dict:
    duration = len(signal) / sr
    # 120 waveform peaks for the seek bar
    chunks = np.array_split(np.abs(signal), 120)
    peaks = np.array([c.max() if len(c) else 0 for c in chunks])
    peaks = (peaks / max(peaks.max(), 1e-6)).round(3).tolist()
    # loudness (RMS dB over 0.5 s windows, upper percentile = how loud it gets)
    win = sr // 2
    frames = signal[: len(signal) // win * win].reshape(-1, win)
    rms_db = 20 * np.log10(np.sqrt((frames ** 2).mean(axis=1)) + 1e-9)
    loud = float(np.percentile(rms_db, 75))
    # spectral-flux onset envelope -> autocorrelation tempo (60-170 BPM)
    hop, n = 512, 1024
    spec = np.abs(np.fft.rfft(np.lib.stride_tricks.sliding_window_view(signal, n)[::hop] * np.hanning(n), axis=1))
    flux = np.maximum(0, np.diff(np.log1p(spec), axis=0)).sum(axis=1)
    flux = flux - flux.mean()
    ac = np.correlate(flux, flux, mode="full")[len(flux) - 1:]
    fps = sr / hop
    lags = np.arange(int(fps * 60 / 170), int(fps * 60 / 60))
    bpm = 60 * fps / lags[np.argmax(ac[lags])]
    while bpm > 140:  # autocorrelation often locks onto double time on gentle tracks
        bpm /= 2
    bpm = int(round(bpm))
    return {"duration": round(duration, 2), "peaks": peaks, "loud_db": loud, "bpm": bpm, "onset": float(np.mean(np.abs(flux)))}


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"not found: {SOURCE}")
    AUDIO.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)

    # 1. Discover files and their placements, merging identical files.
    by_hash: dict[str, dict] = {}
    for mood_dir in sorted(p for p in SOURCE.iterdir() if p.is_dir()):
        key = next((v for k, v in MOODS.items() if k in mood_dir.name.lower()), None)
        if not key:
            print(f"  skip folder (unknown mood): {mood_dir.name}")
            continue
        for band_dir in sorted(p for p in mood_dir.iterdir() if p.is_dir()):
            band = parse_band(band_dir.name)
            if not band:
                print(f"  skip folder (no intensity range): {mood_dir.name}/{band_dir.name}")
                continue
            for f in sorted(band_dir.glob("*.mp3")):
                h = hashlib.sha1(f.read_bytes()).hexdigest()
                entry = by_hash.setdefault(h, {"files": [], "placements": []})
                entry["files"].append(f)
                p = {"mood": key[0], "min": band[0], "max": band[1]}
                if p not in entry["placements"]:
                    entry["placements"].append(p)

    # 2. Build tracks.
    tracks, manifest_add, seen_titles, used_ids = [], {}, {}, set()
    for h, entry in by_hash.items():
        f = entry["files"][0]
        title, artist, art, lyrics, ai = None, None, None, False, False
        try:
            tags = ID3(f)
            title = str(tags.get("TIT2") or "").strip() or None
            artist = str(tags.get("TPE1") or "").strip() or None
            lyrics = any(k.startswith("USLT") and str(v).strip() for k, v in tags.items())
            ai = "suno" in " ".join(str(v) for k, v in tags.items() if k.startswith(("COMM", "TXXX", "WOAS"))).lower()
            pics = tags.getall("APIC")
            art = pics[0] if pics else None
        except ID3NoHeaderError:
            pass
        if not title:
            names = [tidy_filename(x.stem) for x in entry["files"]]
            title = next((n for n in names if n != "Untitled"), names[0])
        n = seen_titles.get(title.lower(), 0) + 1
        seen_titles[title.lower()] = n
        display = title if n == 1 else f"{title} (II)" if n == 2 else f"{title} ({n})"

        base = slug(title) or f"song-{h[:6]}"
        tid = f"mine-{base}"
        while tid in used_ids:
            tid = f"mine-{base}-{h[:4]}"
        used_ids.add(tid)

        shutil.copyfile(f, AUDIO / f"{tid}.mp3")
        artwork = None
        if art and art.data:
            ext = "png" if "png" in (art.mime or "") else "jpg"
            (ART / f"{tid}.{ext}").write_bytes(art.data)
            artwork = f"/artwork/{tid}.{ext}"

        a = analyse(decode(f))
        manifest_add[tid] = {"duration": a["duration"], "peaks": a["peaks"]}

        places = sorted(entry["placements"], key=lambda p: (MOOD_ORDER.index(p["mood"]), p["min"]))
        primary = places[0]["mood"]
        moods = []
        for p in places:
            if p["mood"] not in moods:
                moods.append(p["mood"])
        bands = [p for p in places if p["mood"] == primary]
        mid = sum((p["min"] + p["max"]) / 2 for p in bands) / len(bands)
        tracks.append({
            "id": tid,
            "title": display,
            "artist": artist or "Unknown artist",
            "album": "My songs",
            "audio": f"/audio/{tid}.mp3",
            "artwork": artwork,
            "primaryMood": primary,
            "secondaryMoods": moods[1:4],
            "_loud": a["loud_db"],
            "_onset": a["onset"],
            "_mid": mid,
            "tempo": "slow" if a["bpm"] < 80 else "moderate" if a["bpm"] < 110 else "upbeat" if a["bpm"] < 135 else "fast",
            "bpm": a["bpm"],
            "genre": "Original",
            "instrumentation": [],
            "vocals": "vocal" if lyrics else "instrumental",
            "intensityRange": [min(p["min"] for p in bands), max(p["max"] for p in bands)],
            "placements": places,
            "description": "",
            "isOriginal": True,
            "isSample": False,
            "aiAssisted": ai,
            "credits": f"{'Made with Suno · ' if ai else ''}{artist or 'imported from your library'}",
        })
        print(f"  {tid:<36} {display[:30]:<30} {a['duration']:>6.0f}s  {a['bpm']:>3} bpm  "
              f"{'vocal' if lyrics else 'instr'}  " + ", ".join(f"{p['mood'][:7]} {p['min']:.2f}-{p['max']:.2f}" for p in places))

    # 3. Energy relative to the imported set; valence from where you placed it
    #    (songs for milder feelings lean brighter).
    louds = np.array([t["_loud"] for t in tracks])
    onsets = np.array([t["_onset"] for t in tracks])
    norm = lambda v, arr: float((v - arr.min()) / max(arr.max() - arr.min(), 1e-6))
    labels = {v[0]: v[1] for v in MOODS.values()}
    for t in tracks:
        t["energy"] = round(0.15 + 0.6 * (0.6 * norm(t.pop("_loud"), louds) + 0.4 * norm(t.pop("_onset"), onsets)), 2)
        mid = t.pop("_mid")
        t["valence"] = round(0.25 + 0.4 * (1 - mid), 2)
        where = "; ".join(f"{labels[p['mood']]} at {round(p['min'] * 100)}–{round(p['max'] * 100)}%" for p in t["placements"])
        t["description"] = f"One of your songs, placed for feeling {where}."

    collections = []
    for mood in MOOD_ORDER:
        ids = [t["id"] for t in tracks if any(p["mood"] == mood for p in t["placements"])]
        if ids:
            cid, ctitle, cdesc, pal = COLLECTIONS[mood]
            ids.sort(key=lambda i: min(p["min"] for t in tracks if t["id"] == i for p in t["placements"] if p["mood"] == mood))
            collections.append({"id": cid, "title": ctitle, "description": cdesc, "palette": pal, "trackIds": ids})

    OUT.write_text(json.dumps({
        "$comment": "Generated by scripts/import_songs.py from your mood/intensity folders. Re-run to update; edit titles here if you like.",
        "collections": collections,
        "tracks": tracks,
    }, ensure_ascii=False, indent=2) + "\n")
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    manifest = {k: v for k, v in manifest.items() if not k.startswith("mine-")}
    manifest.update(manifest_add)
    MANIFEST.write_text(json.dumps(manifest, indent=1) + "\n")
    print(f"\n{len(tracks)} tracks from {sum(len(e['files']) for e in by_hash.values())} files -> {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
