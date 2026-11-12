"""Generate Sonora's sample music library: original, license-free sketches
synthesised from each track's catalogue metadata (bpm, energy, valence,
instrumentation). Nothing here is sampled from existing recordings.

These are placeholders so every feature (playback, seeking, queueing,
recommendations) works end-to-end. Replace them with real music by editing
src/data/catalog.json and dropping files into public/audio/.

Outputs:
  public/audio/<id>.mp3           - 128 kbps stereo MP3
  src/data/audio-manifest.json    - duration + waveform peaks per track

Usage:  python scripts/generate_sample_audio.py [--only id1,id2]
Requires: numpy, lameenc
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import lameenc
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CATALOG = ROOT / "src" / "data" / "catalog.json"
AUDIO_DIR = ROOT / "public" / "audio"
MANIFEST = ROOT / "src" / "data" / "audio-manifest.json"

SR = 32000
PEAK_BUCKETS = 120

MODES = {
    "lydian": [0, 2, 4, 6, 7, 9, 11],
    "major": [0, 2, 4, 5, 7, 9, 11],
    "mixolydian": [0, 2, 4, 5, 7, 9, 10],
    "dorian": [0, 2, 3, 5, 7, 9, 10],
    "minor": [0, 2, 3, 5, 7, 8, 10],
}
PROGRESSIONS = [
    [0, 5, 3, 4], [0, 3, 5, 4], [5, 3, 0, 4], [0, 4, 5, 3],
    [0, 3, 0, 4], [0, 5, 1, 4], [3, 4, 0, 0], [0, 2, 3, 3],
]


def hz(midi: float) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


class Track:
    def __init__(self, meta: dict):
        self.meta = meta
        seed = int(hashlib.sha256(meta["id"].encode()).hexdigest()[:8], 16)
        self.rng = np.random.default_rng(seed)
        self.bpm = meta["bpm"]
        self.energy = meta["energy"]
        self.valence = meta["valence"]
        self.layers = set(meta["instrumentation"])
        self.beat = 60.0 / self.bpm

        v = self.valence
        mode = ("lydian" if v >= 0.8 else "major" if v >= 0.6 else
                "mixolydian" if v >= 0.5 else "dorian" if v >= 0.35 else "minor")
        self.scale = MODES[mode]
        self.root = 45 + int(self.rng.integers(0, 8))           # A2..E3
        self.progression = PROGRESSIONS[int(self.rng.integers(0, len(PROGRESSIONS)))]

        self.beats_per_chord = 8 if self.bpm < 90 else 4
        target_seconds = 54 + 8 * self.rng.random()
        n_chords = max(8, round(target_seconds / (self.beats_per_chord * self.beat)))
        n_chords += (-n_chords) % len(self.progression)
        self.n_chords = n_chords
        self.total_beats = n_chords * self.beats_per_chord
        self.length = int((self.total_beats * self.beat + 4.0) * SR)  # +4 s reverb tail
        self.L = np.zeros(self.length)
        self.R = np.zeros(self.length)

    # ---- harmony -----------------------------------------------------------
    def degree_to_midi(self, degree: int, octave: int = 0) -> int:
        o, d = divmod(degree, 7)
        return self.root + 12 * (o + octave) + self.scale[d]

    def chord(self, index: int, octave: int = 1, sevenths: bool = False) -> list[int]:
        d = self.progression[index % len(self.progression)]
        tones = [d, d + 2, d + 4] + ([d + 6] if sevenths else [])
        return [self.degree_to_midi(t, octave) for t in tones]

    def chord_bounds(self, index: int) -> tuple[float, float]:
        start = index * self.beats_per_chord * self.beat
        return start, start + self.beats_per_chord * self.beat

    # ---- arrangement -------------------------------------------------------
    def section_gain(self, t: float, layer: str) -> float:
        """Intro (pads only) -> full -> breakdown -> full -> outro."""
        total = self.total_beats * self.beat
        p = t / total
        rhythmic = layer in {"drums", "drums-soft", "bass", "pulse", "arp", "pluck"}
        if p < 0.12:
            return 0.0 if rhythmic else 1.0
        if 0.55 < p < 0.68 and layer in {"drums", "drums-soft"}:
            return 0.0
        return 1.0

    # ---- primitives --------------------------------------------------------
    def add(self, sig: np.ndarray, start: float, pan: float = 0.0, gain: float = 1.0):
        i = int(start * SR)
        if i >= self.length:
            return
        sig = sig[: self.length - i] * gain
        l_g = np.cos((pan + 1) * np.pi / 4)
        r_g = np.sin((pan + 1) * np.pi / 4)
        self.L[i:i + len(sig)] += sig * l_g
        self.R[i:i + len(sig)] += sig * r_g

    @staticmethod
    def tone(freq: float, dur: float, partials, decay: float | None = None,
             attack: float = 0.005, release: float = 0.08, vibrato: float = 0.0) -> np.ndarray:
        n = max(1, int(dur * SR))
        t = np.arange(n) / SR
        phase_mod = vibrato * np.sin(2 * np.pi * 5.2 * t) if vibrato else 0.0
        sig = np.zeros(n)
        for mult, amp in partials:
            f = freq * mult
            if f > SR / 2.2:
                continue
            sig += amp * np.sin(2 * np.pi * f * t + phase_mod * mult)
        env = np.ones(n)
        a = min(n, int(attack * SR))
        if a:
            env[:a] = np.linspace(0, 1, a)
        if decay:
            env *= np.exp(-t / decay)
        r = min(n, int(release * SR))
        if r:
            env[-r:] *= np.linspace(1, 0, r)
        return sig * env

    # ---- layers ------------------------------------------------------------
    def pads(self, strings: bool = False):
        attack = 2.4 if strings else 1.4
        partials = [(1, 1), (2, .45), (3, .22), (4, .12), (5, .07), (6, .04)]
        if strings:
            partials = [(1, 1), (2, .6), (3, .4), (4, .25), (5, .18), (6, .12), (7, .08)]
        for i in range(self.n_chords):
            s, e = self.chord_bounds(i)
            dur = e - s + 1.2
            for j, note in enumerate(self.chord(i, octave=1 if not strings else 2, sevenths=self.valence > 0.55)):
                for detune, pan in ((-0.07, -0.6), (0.07, 0.6)):
                    sig = self.tone(hz(note + detune), dur, partials, attack=attack,
                                    release=1.2, vibrato=0.0025 if strings else 0.0)
                    self.add(sig, s, pan=pan * (0.4 + 0.15 * j),
                             gain=(0.05 if strings else 0.055) * self.section_gain(s, "pads"))

    def choir(self):
        formants = [(730, 90), (1090, 110), (2440, 160)]  # an "ah" vowel
        for i in range(self.n_chords):
            s, e = self.chord_bounds(i)
            for note in self.chord(i, octave=2):
                f0 = hz(note)
                parts = []
                for k in range(1, int(4000 / f0)):
                    fk = f0 * k
                    amp = sum(np.exp(-((fk - fc) / bw) ** 2) for fc, bw in formants) / k ** 0.3
                    parts.append((k, amp))
                sig = self.tone(f0, e - s + 1.5, parts, attack=2.0, release=1.5, vibrato=0.004)
                self.add(sig, s, pan=self.rng.uniform(-0.5, 0.5), gain=0.03)

    def keys(self, bright: bool = False):
        decay = 0.35 if bright else 1.3
        partials = [(1, .7), (2, .3), (3, .12), (4, .06)] if not bright else \
                   [(1, .6), (2, .35), (3, .25), (4, .12), (6, .05)]
        step = 0.5 if (bright or self.bpm >= 85) else 1.0
        pattern = self.rng.permutation(8)
        for i in range(self.n_chords):
            s, e = self.chord_bounds(i)
            tones = self.chord(i, octave=2) + [self.chord(i, octave=3)[0]]
            n_steps = int((e - s) / (step * self.beat))
            for k in range(n_steps):
                if bright and (k % 4 == 3) and self.rng.random() < 0.5:
                    continue
                t = s + k * step * self.beat
                note = tones[pattern[k % len(pattern)] % len(tones)]
                vel = 0.75 + 0.25 * self.rng.random()
                sig = self.tone(hz(note), 2.4 if not bright else 0.6, partials, decay=decay)
                self.add(sig, t, pan=-0.25 if not bright else 0.3,
                         gain=0.11 * vel * self.section_gain(t, "pluck" if bright else "keys"))

    def bells(self):
        partials = [(1, 1), (2.0, .4), (2.76, .3), (5.4, .12)]
        for i in range(self.n_chords):
            s, e = self.chord_bounds(i)
            tones = self.chord(i, octave=3)
            for b in range(0, self.beats_per_chord, 2):
                if self.rng.random() < 0.55:
                    t = s + b * self.beat
                    sig = self.tone(hz(tones[int(self.rng.integers(0, 3))]), 3.5, partials, decay=1.6)
                    self.add(sig, t, pan=0.45, gain=0.045)

    def arp(self):
        step = 0.25 if self.bpm >= 95 else 0.5
        partials = [(1, 1), (2, .5), (3, .33), (4, .25)]
        for i in range(self.n_chords):
            s, e = self.chord_bounds(i)
            tones = self.chord(i, octave=2) + self.chord(i, octave=3)
            seq = tones + tones[-2:0:-1]
            n_steps = int((e - s) / (step * self.beat))
            for k in range(n_steps):
                t = s + k * step * self.beat
                sig = self.tone(hz(seq[k % len(seq)]), 0.3, partials, decay=0.12)
                self.add(sig, t, pan=0.5 if k % 2 else -0.5, gain=0.05 * self.section_gain(t, "arp"))

    def pulse(self):
        partials = [(1, 1), (3, .33), (5, .2), (7, .14)]
        for i in range(self.n_chords):
            s, e = self.chord_bounds(i)
            root = self.chord(i, octave=1)[0]
            n_steps = int((e - s) / (0.5 * self.beat))
            for k in range(n_steps):
                t = s + k * 0.5 * self.beat
                note = root if k % 4 != 2 else root + 7
                sig = self.tone(hz(note), 0.5 * self.beat, partials, decay=0.18, release=0.03)
                self.add(sig, t, pan=0.1, gain=0.05 * self.section_gain(t, "pulse"))

    def bass(self):
        step = 2.0 if self.bpm < 80 else 1.0 if self.energy < 0.6 else 0.5
        for i in range(self.n_chords):
            s, e = self.chord_bounds(i)
            root = self.chord(i, octave=0)[0]
            n_steps = int((e - s) / (step * self.beat))
            for k in range(n_steps):
                t = s + k * step * self.beat
                note = root if (k % 4 != 3 or self.energy < 0.5) else root + 12
                sig = self.tone(hz(note), step * self.beat * 0.95, [(1, 1), (2, .3), (3, .08)],
                                decay=0.6 if self.energy < 0.6 else 0.25, release=0.05)
                self.add(sig, t, gain=0.16 * self.section_gain(t, "bass"))

    def drums(self, soft: bool = False):
        kick_n = int(0.35 * SR)
        tk = np.arange(kick_n) / SR
        kick = np.sin(2 * np.pi * (45 * tk + 60 * (1 - np.exp(-tk * 30)) / 30)) * np.exp(-tk * 9)
        hat_n = int(0.06 * SR)
        hat = highpass(self.rng.standard_normal(hat_n), 7000) * np.exp(-np.arange(hat_n) / SR * 70)
        sn_n = int(0.22 * SR)
        ts = np.arange(sn_n) / SR
        snare = (bandpass(self.rng.standard_normal(sn_n), 1500, 6000) * 0.8 +
                 np.sin(2 * np.pi * 190 * ts) * 0.5) * np.exp(-ts * 18)

        four_floor = self.bpm >= 115 and not soft
        for beat in range(self.total_beats):
            t = beat * self.beat
            g = self.section_gain(t, "drums-soft" if soft else "drums")
            if g == 0:
                continue
            if four_floor or beat % 4 in (0, 2) or (not soft and beat % 8 == 7):
                self.add(kick, t, gain=(0.35 if soft else 0.55) * g)
            if beat % 4 in (1, 3) and (not soft or self.energy > 0.35):
                self.add(snare, t, pan=0.05, gain=(0.08 if soft else 0.2) * g)
            subdivisions = 4 if (self.energy > 0.65 and not soft) else 2
            for sdiv in range(subdivisions):
                th = t + sdiv * self.beat / subdivisions
                accent = 1.0 if sdiv == 0 else 0.6
                self.add(hat, th + self.rng.normal(0, 0.004), pan=0.35,
                         gain=(0.05 if soft else 0.08) * accent * g)

    def vinyl(self):
        n = self.length
        hiss = lowpass(self.rng.standard_normal(n), 4000) * 0.006
        crackle = np.zeros(n)
        idx = self.rng.choice(n, size=int(n / SR * 9), replace=False)
        crackle[idx] = self.rng.uniform(-0.25, 0.25, size=len(idx))
        crackle = highpass(crackle, 1500)
        self.L += hiss + crackle * 0.5
        self.R += hiss + np.roll(crackle, 37) * 0.5

    def noise_bed(self):
        n = self.length
        t = np.arange(n) / SR
        swell = 0.6 + 0.4 * np.sin(2 * np.pi * t / 11.0)
        rain = bandpass(self.rng.standard_normal(n), 900, 7000) * 0.014 * swell
        self.L += rain
        self.R += np.roll(rain, 211)

    # ---- render ------------------------------------------------------------
    def render(self) -> np.ndarray:
        layers = self.layers
        if "pads" in layers:
            self.pads()
        if "strings" in layers:
            self.pads(strings=True)
        if "choir" in layers:
            self.choir()
        if "piano" in layers:
            self.keys()
        if "pluck" in layers:
            self.keys(bright=True)
        if "bells" in layers:
            self.bells()
        if "arp" in layers:
            self.arp()
        if "pulse" in layers:
            self.pulse()
        if "bass" in layers:
            self.bass()
        if "drums" in layers:
            self.drums()
        if "drums-soft" in layers:
            self.drums(soft=True)
        if "vinyl" in layers:
            self.vinyl()
        if "noise" in layers:
            self.noise_bed()

        # Darker, warmer tone for low-valence tracks.
        cutoff = 3500 + 6000 * self.valence * (0.6 + 0.4 * self.energy)
        L, R = lowpass(self.L, cutoff), lowpass(self.R, cutoff)

        decay = 3.2 - 2.0 * self.energy
        wet = 0.32 - 0.15 * self.energy
        L, R = reverb(L, R, decay, wet, self.rng)

        fade_in, fade_out = int(1.5 * SR), int(4.5 * SR)
        env = np.ones(self.length)
        env[:fade_in] = np.linspace(0, 1, fade_in) ** 2
        env[-fade_out:] = np.linspace(1, 0, fade_out) ** 1.5
        stereo = np.stack([L * env, R * env], axis=1)

        rms = np.sqrt(np.mean(stereo ** 2)) + 1e-9
        target = 0.12 + 0.06 * self.energy
        stereo = np.tanh(stereo * (target / rms) * 1.2) / np.tanh(1.2)
        stereo *= 0.89 / (np.abs(stereo).max() + 1e-9)
        return stereo


# ---- FFT filters (no scipy needed) -------------------------------------------
def _fft_filter(x: np.ndarray, gain_fn) -> np.ndarray:
    n = len(x)
    spec = np.fft.rfft(x)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    return np.fft.irfft(spec * gain_fn(freqs), n)


def lowpass(x, cutoff):
    return _fft_filter(x, lambda f: 1 / np.sqrt(1 + (f / cutoff) ** 4))


def highpass(x, cutoff):
    return _fft_filter(x, lambda f: 1 / np.sqrt(1 + (cutoff / np.maximum(f, 1)) ** 4))


def bandpass(x, lo, hi):
    return highpass(lowpass(x, hi), lo)


def reverb(L, R, decay, wet, rng):
    n_ir = int(decay * SR)
    t = np.arange(n_ir) / SR
    env = np.exp(-6.9 * t / decay)
    out = []
    for ch in (L, R):
        ir = lowpass(rng.standard_normal(n_ir), 5000) * env
        ir[: int(0.012 * SR)] = 0  # pre-delay
        ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
        size = 1 << int(np.ceil(np.log2(len(ch) + n_ir)))
        conv = np.fft.irfft(np.fft.rfft(ch, size) * np.fft.rfft(ir, size), size)[: len(ch)]
        out.append(ch * (1 - wet) + conv * wet * 0.9)
    return out


def encode_mp3(stereo: np.ndarray, path: Path) -> None:
    pcm = (np.clip(stereo, -1, 1) * 32767).astype("<i2")
    enc = lameenc.Encoder()
    enc.set_bit_rate(128)
    enc.set_in_sample_rate(SR)
    enc.set_channels(2)
    enc.set_quality(2)
    data = enc.encode(pcm.tobytes()) + enc.flush()
    path.write_bytes(data)


def peaks(stereo: np.ndarray) -> list[float]:
    mono = np.abs(stereo).max(axis=1)
    buckets = np.array_split(mono, PEAK_BUCKETS)
    vals = np.array([b.max() if len(b) else 0 for b in buckets])
    vals = vals / (vals.max() + 1e-9)
    return [round(float(v), 3) for v in vals]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    args = ap.parse_args()
    only = {s.strip() for s in args.only.split(",") if s.strip()}

    catalog = json.loads(CATALOG.read_text())
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}

    for meta in catalog["tracks"]:
        if only and meta["id"] not in only:
            continue
        if not meta.get("isSample"):
            continue  # never overwrite real music
        track = Track(meta)
        stereo = track.render()
        out = ROOT / "public" / meta["audio"].lstrip("/")
        encode_mp3(stereo, out)
        manifest[meta["id"]] = {
            "duration": round(len(stereo) / SR, 2),
            "peaks": peaks(stereo),
        }
        print(f"{meta['id']:<20} {len(stereo) / SR:5.1f}s  {out.stat().st_size / 1e6:.2f} MB")

    MANIFEST.write_text(json.dumps(manifest, indent=1, sort_keys=True))


if __name__ == "__main__":
    main()
