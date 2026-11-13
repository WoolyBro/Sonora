"""Score an emotion checkpoint on the hand-written check-in set.

The check-in set (emotion-music-ai/data/annotations/checkin_eval_v1.csv) is the
only data written the way Sonora's users actually write: short, first-person,
present tense. It is split into `dev` (used to pick models and thresholds) and
`test` (looked at once, for the final report). Never tune on `test`.

Metrics
  top1      share of labelled rows whose highest-scoring mood is one of the
            annotated moods. This is the headline the app shows.
  top1_nonumb  same, ignoring rows whose only label is numbness (the shipped
            model can't predict numbness, so those rows are guaranteed misses).
  macro_f1  presence detection per mood at one threshold, averaged.
  none_fp   rows annotated with no emotion where some mood still fires.

Run:  .venv/bin/python eval_checkins.py --model <checkpoint dir> [--split dev]
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

ROOT = Path(__file__).resolve().parent
SOURCE = Path("/Users/ayushmondal/Desktop/Ideapad/VS/Python/Music/emotion-music-ai")
EVAL_CSV = SOURCE / "data" / "annotations" / "checkin_eval_v1.csv"
TARGETS_8 = ["sadness", "anxiety", "anger", "stress", "numbness", "joy", "connection", "calm"]


def load_eval(split: str | None) -> pd.DataFrame:
    df = pd.read_csv(EVAL_CSV, keep_default_na=False)
    if split:
        df = df[df["split"] == split].reset_index(drop=True)
    df["labels"] = df["emotions"].apply(lambda e: [x.strip() for x in e.split(";")] if e else [])
    return df


def device() -> torch.device:
    return torch.device("mps" if torch.backends.mps.is_available() else "cpu")


@torch.no_grad()
def predict(model_dir: Path, texts: list[str], batch: int = 64) -> tuple[np.ndarray, list[str], set[str]]:
    """Sigmoid probabilities in the checkpoint's head order, masked heads zeroed."""
    cfg_path = model_dir / "config_training.json"
    cfg = json.loads(cfg_path.read_text()) if cfg_path.exists() else {}
    order = cfg.get("targets_8", TARGETS_8)
    masked = set(cfg.get("masked_unsupervised", []))
    max_len = cfg.get("max_len", 128)

    dev = device()
    tok = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(model_dir).to(dev).eval()
    out = []
    for i in range(0, len(texts), batch):
        enc = tok(texts[i:i + batch], truncation=True, max_length=max_len, padding=True, return_tensors="pt").to(dev)
        out.append(torch.sigmoid(model(**enc).logits.float()).cpu().numpy())
    probs = np.concatenate(out)
    for j, name in enumerate(order):
        if name in masked:
            probs[:, j] = 0.0
    return probs, order, masked


def score(probs: np.ndarray, order: list[str], df: pd.DataFrame, threshold: float) -> dict:
    labelled = df["labels"].apply(len) > 0
    top = [order[i] for i in probs.argmax(1)]
    hits = np.array([t in labs for t, labs in zip(top, df["labels"])])
    only_numb = df["labels"].apply(lambda l: l == ["numbness"])

    per = {}
    f1s = []
    for j, name in enumerate(order):
        y = df["labels"].apply(lambda l: name in l).to_numpy()[labelled.to_numpy()]
        p = (probs[labelled.to_numpy(), j] >= threshold)
        tp = int((p & y).sum()); fp = int((p & ~y).sum()); fn = int((~p & y).sum())
        prec = tp / (tp + fp) if tp + fp else 0.0
        rec = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
        top1_recall = float(np.mean([t == name for t, labs in zip(top, df["labels"]) if name in labs])) if y.any() else None
        per[name] = {"support": int(y.sum()), "precision": round(prec, 3), "recall": round(rec, 3),
                     "f1": round(f1, 3), "top1_recall": None if top1_recall is None else round(top1_recall, 3)}
        if y.any():
            f1s.append(f1)

    none_rows = ~labelled.to_numpy()
    none_fp = int((probs[none_rows] >= threshold).any(1).sum())
    return {
        "rows": int(labelled.sum()),
        "top1": round(float(hits[labelled.to_numpy()].mean()), 4),
        "top1_hits": f"{int(hits[labelled.to_numpy()].sum())}/{int(labelled.sum())}",
        "top1_nonumb": round(float(hits[(labelled & ~only_numb).to_numpy()].mean()), 4),
        "macro_f1": round(float(np.mean(f1s)), 4),
        "threshold": threshold,
        "none_fp": f"{none_fp}/{int(none_rows.sum())}",
        "per_class": per,
    }


def best_threshold(probs: np.ndarray, order: list[str], df: pd.DataFrame) -> float:
    grid = np.round(np.arange(0.2, 0.96, 0.05), 2)
    return float(max(grid, key=lambda t: score(probs, order, df, t)["macro_f1"]))


def evaluate(model_dir: Path, split: str = "dev", threshold: float | None = None) -> dict:
    df = load_eval(split)
    probs, order, _ = predict(model_dir, df["text"].tolist())
    if threshold is None:
        dev = load_eval("dev")
        dprobs = probs if split == "dev" else predict(model_dir, dev["text"].tolist())[0]
        threshold = best_threshold(dprobs, order, dev)  # chosen on dev only
    return score(probs, order, df, threshold)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", type=Path, required=True)
    ap.add_argument("--split", default="dev", choices=["dev", "test", "all"])
    ap.add_argument("--threshold", type=float, default=None)
    ap.add_argument("--per-class", action="store_true")
    args = ap.parse_args()
    res = evaluate(args.model, None if args.split == "all" else args.split, args.threshold)
    if not args.per_class:
        res = {k: v for k, v in res.items() if k != "per_class"}
    print(json.dumps(res, indent=2))


if __name__ == "__main__":
    main()
