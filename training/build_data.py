"""Build Sonora's expanded emotion training set.

Starts from the carefully mapped corpus built by emotion-music-ai
(GoEmotions + EmpatheticDialogues situations + Dreaddit stress, see its
src/labels.py and reports/AUDIT_phases1-5.md) and adds three human-written
sources, each mapped onto Sonora's eight moods with explicit rules:

1. EmpatheticDialogues opening lines (~17k). Each conversation starts with the
   speaker describing their feeling in their own words, first person, present
   tense ("it feels like hitting a blank wall when i see the darkness"). This
   is the closest public text to a check-in. Same label as the conversation's
   situation, same split as that situation (so nothing leaks into dev/test).

2. SemEval-2018 Task 1 E-c, English (~11k tweets, several human annotators per
   tweet). anger/disgust -> anger, fear -> anxiety, joy/optimism -> joy,
   love -> connection, sadness/pessimism -> sadness.

3. CARER / dair-ai/emotion "i feel ..." posts, RELABELLED. CARER's own labels
   were assigned automatically from the feeling word and clash with Sonora's
   taxonomy ("stressed" is filed under anger/fear, "relaxed" under joy, "numb"
   under sadness). Here the feeling word is mapped with FEELING_WORDS below
   instead, which gives real self-reports for the three moods with the least
   data: stress, calm and numbness. Rows whose feeling word isn't in the list
   are dropped. Single-label source, so only opposite-valence moods are set to
   0; same-valence moods stay UNKNOWN (stressed people are often anxious too).
   Down-weighted (0.5) because the label comes from one word.

A label is 1/0 where known and -1 (UNKNOWN, masked out of the loss) where not.
Every text that appears in the hand-written check-in evaluation set is removed.

Run:  .venv/bin/python build_data.py
"""

from __future__ import annotations

import hashlib
import re
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent
SOURCE = Path("/Users/ayushmondal/Desktop/Ideapad/VS/Python/Music/emotion-music-ai")
sys.path.insert(0, str(SOURCE))
from src.content_reclassification import build_override as build_content_override  # noqa: E402
from src.labels import EMPATHETIC_MAP  # noqa: E402

RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "processed"
TARGETS_8 = ["sadness", "anxiety", "anger", "stress", "numbness", "joy", "connection", "calm"]
NEGATIVE = {"sadness", "anxiety", "anger", "stress", "numbness"}
POSITIVE = {"joy", "connection", "calm"}
UNKNOWN = -1
MIN_CHARS = 8
SEED = 42

# Feeling word -> Sonora mood. Deliberately conservative: words that could mean
# several moods ("safe", "down", "dull", "good", "restless", "uncertain",
# "vulnerable", "sorry", "guilty") are left out rather than guessed.
FEELING_WORDS: dict[str, list[str]] = {
    "sadness": ["sad", "unhappy", "depressed", "miserable", "heartbroken", "lonely", "hopeless",
                "gloomy", "devastated", "crushed", "disappointed", "hurt", "defeated", "broken",
                "melancholy", "sorrowful", "discouraged", "dejected", "despondent", "gutted",
                "isolated", "rejected", "unwanted", "alone", "low", "heartbroken", "grief"],
    "anxiety": ["anxious", "nervous", "worried", "scared", "afraid", "frightened", "terrified",
                "uneasy", "apprehensive", "insecure", "panicky", "panicked", "fearful", "paranoid",
                "jittery", "jumpy", "threatened", "shaky", "dread"],
    "anger": ["angry", "mad", "furious", "irritated", "annoyed", "frustrated", "resentful", "bitter",
              "outraged", "livid", "irritable", "enraged", "pissed", "hostile", "cranky", "grumpy",
              "aggravated", "infuriated", "disgusted", "offended"],
    "stress": ["stressed", "overwhelmed", "pressured", "drained", "exhausted", "frazzled", "overworked",
               "swamped", "burnt", "burned", "frantic", "harried", "overloaded", "frazzled"],
    "numbness": ["numb", "empty", "hollow", "blank", "detached", "disconnected", "apathetic",
                 "indifferent", "emotionless", "lifeless"],
    "joy": ["happy", "glad", "excited", "delighted", "cheerful", "joyful", "thrilled", "elated",
            "ecstatic", "proud", "optimistic", "hopeful", "grateful", "thankful", "overjoyed",
            "enthusiastic", "fantastic", "wonderful", "awesome", "amazing", "lucky", "blessed"],
    "connection": ["loved", "loving", "supported", "appreciated", "accepted", "cherished", "valued",
                   "welcomed", "affectionate", "tender", "caring", "compassionate", "nostalgic",
                   "sentimental", "romantic", "connected", "included"],
    "calm": ["calm", "peaceful", "relaxed", "serene", "tranquil", "content", "mellow", "rested",
             "refreshed", "relieved", "settled"],
}
WORD_TO_MOOD = {w: m for m, ws in FEELING_WORDS.items() for w in ws}

# "i feel [so|really|...] WORD" with CARER's apostrophe-less spellings (im, i m).
FEEL = re.compile(
    r"\b(?:i|im|i m|i am|i was|i ve been|i have been)\s+(?:feel|feeling|felt)\s+"
    r"((?:(?:so|very|really|a bit|kind of|kinda|quite|pretty|extremely|totally|completely|too|"
    r"rather|a little|just|more|less|incredibly|super|truly|fairly|somewhat|slightly|utterly|"
    r"absolutely|deeply|genuinely|increasingly|strangely|oddly|almost|all|very very)\s+)*)([a-z]+)"
)
NOTHING_OK = re.compile(r"\bfeel(?:ing)?\s+nothing\s*(?:$|at all|anymore|inside|any more|right now|today)")


def norm(text: str) -> str:
    return re.sub(r"[^a-z0-9 ]", "", re.sub(r"\s+", " ", str(text).lower())).strip()


def split_of(text: str, dev_share: float = 0.1) -> str:
    h = int(hashlib.md5(text.encode()).hexdigest(), 16) % 1000
    return "dev" if h < dev_share * 1000 else "train"


# Moods that plausibly co-occur with the named one. For a single-label "i feel X"
# post these stay UNKNOWN; every other mood is 0. (Someone who writes "i feel
# sad" is reporting a feeling, so they aren't numb; "i feel numb" may still be sad.)
CO_OCCUR: dict[str, set[str]] = {
    "stress": {"anxiety", "anger", "sadness"},
    "anxiety": {"stress", "sadness"},
    "anger": {"stress", "sadness"},
    "sadness": {"anxiety", "anger", "stress"},
    "numbness": {"sadness", "stress"},
    "joy": {"connection", "calm"},
    "connection": {"joy", "calm"},
    "calm": {"joy", "connection"},
}
# Numbness (flat, detached) can't sit alongside an active emotion. Multi-label
# corpora never annotate numbness, so without this the head only ever sees
# "negative text -> unknown" and learns that every negative feeling is numbness.
NOT_NUMB_IF = ["anxiety", "anger", "joy", "connection", "calm"]


def labels_for(target: str, single_label: bool) -> dict[str, int]:
    row = {}
    for t in TARGETS_8:
        if t == target:
            row[t] = 1
        elif single_label and t in CO_OCCUR[target]:
            row[t] = UNKNOWN  # could co-occur, we don't know
        else:
            row[t] = 0
    return row


# ── sources ───────────────────────────────────────────────────────────────────


def load_base() -> dict[str, pd.DataFrame]:
    out = {}
    for split in ("train", "dev", "test"):
        df = pd.read_csv(SOURCE / "data" / "processed" / f"{split}.csv")
        df["weight"] = 1.0
        out[split] = df
    return out


def load_ed_openings(base: dict[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    df = pd.read_csv(SOURCE / "data" / "raw" / "emotion69k" / "emotion-emotion_69k.csv")
    df = df[df["emotion"].isin(set(EMPATHETIC_MAP) | {"content"})]
    situation_split = {}
    for split, frame in base.items():
        for t in frame.loc[frame["source"] == "empathetic", "text"]:
            situation_split[str(t).strip()] = split
    content = build_content_override()

    rows = {s: [] for s in ("train", "dev", "test")}
    seen = set()
    for situation, emotion, dialogue in zip(df["Situation"], df["emotion"], df["empathetic_dialogues"]):
        situation = str(situation).strip()
        dialogue = str(dialogue)
        if dialogue.count("Customer :") != 1 or situation in seen:
            continue  # only the conversation's first turn
        m = re.match(r"\s*Customer :\s*(.*?)\s*\nAgent :", dialogue, re.S)
        split = situation_split.get(situation)
        if not m or split is None:
            continue  # situation was excluded upstream (unmapped / ambiguous "content")
        target = content.get(situation) if emotion == "content" else EMPATHETIC_MAP[emotion]
        if target is None:
            continue
        seen.add(situation)
        r = {"text": m.group(1).strip(), "source": "ed_opening", "weight": 1.0}
        r.update({t: int(t == target) for t in TARGETS_8})
        r["stress"] = r["numbness"] = UNKNOWN  # ED doesn't annotate these, same as situations
        rows[split].append(r)
    return {s: pd.DataFrame(v) for s, v in rows.items()}


def load_semeval() -> dict[str, pd.DataFrame]:
    mapping = {"anger": "anger", "disgust": "anger", "fear": "anxiety", "joy": "joy",
               "optimism": "joy", "love": "connection", "sadness": "sadness", "pessimism": "sadness"}
    out = {}
    for split, src in (("train", "train"), ("dev", "validation"), ("test", "test")):
        df = pd.read_csv(RAW / f"semeval2018_ec_en_{src}.csv")
        rows = []
        for _, r in df.iterrows():
            targets = {mapping[k] for k in mapping if bool(r[k])}
            if not targets:
                continue  # trust/anticipation/surprise-only or no emotion: no supervision for us
            row = {"text": re.sub(r"@\w+", "@user", str(r["Tweet"])).strip(), "source": "semeval", "weight": 1.0}
            row.update({t: int(t in targets) for t in TARGETS_8})
            row["stress"] = row["numbness"] = UNKNOWN
            rows.append(row)
        out[split] = pd.DataFrame(rows)
    return out


def load_carer(cap: int = 3000) -> dict[str, pd.DataFrame]:
    df = pd.read_csv(RAW / "carer_unsplit.csv")
    rows = []
    for text in df["text"].astype(str):
        m = FEEL.search(text)
        if not m:
            continue
        word = m.group(2)
        mood = WORD_TO_MOOD.get(word)
        if word == "nothing" and NOTHING_OK.search(text):
            mood = "numbness"
        if word in ("burnt", "burned") and not re.search(r"\b(burnt|burned) out\b", text):
            mood = None
        if mood is None:
            continue
        # Tagged so experiments can use only the scarce moods' posts.
        source = "carer_rare" if mood in ("stress", "calm", "numbness") else "carer_common"
        row = {"text": text.strip(), "source": source, "weight": 0.5, "_mood": mood}
        row.update(labels_for(mood, single_label=True))
        rows.append(row)
    full = pd.DataFrame(rows).drop_duplicates(subset="text")
    # Cap the abundant moods so the relabelled tweets don't swamp human-labelled data.
    full = full.sample(frac=1.0, random_state=SEED).groupby("_mood").head(cap)
    print("  carer per mood:", full["_mood"].value_counts().to_dict())
    full = full.drop(columns="_mood")
    full["_split"] = full["text"].map(split_of)
    return {s: full[full["_split"] == s].drop(columns="_split") for s in ("train", "dev")} | {"test": pd.DataFrame()}


# ── assemble ──────────────────────────────────────────────────────────────────


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    base = load_base()
    print("loading sources…")
    ed = load_ed_openings(base)
    se = load_semeval()
    ca = load_carer()

    checkins = pd.read_csv(SOURCE / "data" / "annotations" / "checkin_eval_v1.csv", keep_default_na=False)
    banned = {norm(t) for t in checkins["text"]}

    seen: set[str] = set()
    summary = []
    for split in ("train", "dev", "test"):
        df = pd.concat([base[split], ed[split], se[split], ca[split]], ignore_index=True)
        df["text"] = df["text"].astype(str).str.strip()
        df = df[df["text"].str.len() >= MIN_CHARS]
        df["_n"] = df["text"].map(norm)
        df = df[~df["_n"].isin(banned)]                 # never train on the evaluation set
        df = df.drop_duplicates(subset="_n")
        df = df[~df["_n"].isin(seen)]                   # a text lives in exactly one split
        seen.update(df["_n"])
        df = df.sample(frac=1.0, random_state=SEED).reset_index(drop=True)
        df[TARGETS_8] = df[TARGETS_8].astype(int)
        active = (df[NOT_NUMB_IF] == 1).any(axis=1)
        df.loc[active & (df["numbness"] == UNKNOWN), "numbness"] = 0
        df[["text", "source", "weight"] + TARGETS_8].to_csv(OUT / f"{split}.csv", index=False)
        row = {"split": split, "rows": len(df)}
        row.update({t: int((df[t] == 1).sum()) for t in TARGETS_8})
        summary.append(row)
        if split == "train":
            print("\ntrain rows by source:", df["source"].value_counts().to_dict())
    print(pd.DataFrame(summary).to_string(index=False))


if __name__ == "__main__":
    main()
