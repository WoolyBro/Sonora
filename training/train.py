"""Fine-tune Sonora's emotion classifier (8 sigmoid heads, masked loss).

Same design as emotion-music-ai/src/train_v2.py, which produced the shipped
model: labels of -1 are UNKNOWN and masked out of the loss; rare moods get a
capped positive weight. Additions: per-row sample weights (relabelled CARER rows
count half), Apple-GPU (MPS) training, and model selection on the hand-written
check-in dev split, evaluated several times per epoch.

Run:  .venv/bin/python train.py --tag v4 [--data data/processed] [--epochs 4]
"""

from __future__ import annotations

import argparse
import json
import math
import time
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader, Dataset, Sampler
from transformers import AutoModelForSequenceClassification, AutoTokenizer, get_linear_schedule_with_warmup

from eval_checkins import TARGETS_8, best_threshold, load_eval, score

ROOT = Path(__file__).resolve().parent
RUNS = ROOT / "runs"
LABEL_NAMES = {"sadness": "LOW_SAD", "anxiety": "ANXIOUS_WORRIED", "anger": "ANGRY_FRUSTRATED",
               "stress": "STRESSED_OVERWHELMED", "numbness": "NUMB_DISCONNECTED", "joy": "POSITIVE_JOYFUL",
               "connection": "AFFECTIONATE_CONNECTED", "calm": "CALM_PEACEFUL"}


class Rows(Dataset):
    def __init__(self, df: pd.DataFrame):
        self.texts = df["text"].astype(str).tolist()
        self.labels = df[TARGETS_8].to_numpy(np.float32)
        self.weights = df["weight"].to_numpy(np.float32) if "weight" in df else np.ones(len(df), np.float32)

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, i):
        return self.texts[i], self.labels[i], self.weights[i]


class LengthGrouped(Sampler):
    """Shuffle, then sort by length inside large chunks, so batches pad little."""

    def __init__(self, lengths, batch, seed):
        self.lengths, self.batch, self.seed, self.epoch = lengths, batch, seed, 0

    def __len__(self):
        return len(self.lengths)

    def __iter__(self):
        g = np.random.RandomState(self.seed + self.epoch)
        self.epoch += 1
        idx = g.permutation(len(self.lengths))
        chunk = self.batch * 50
        batches = []
        for s in range(0, len(idx), chunk):
            c = idx[s:s + chunk]
            c = c[np.argsort([self.lengths[i] for i in c], kind="stable")]
            batches += [c[b:b + self.batch] for b in range(0, len(c), self.batch)]
        g.shuffle(batches)
        return iter([int(i) for b in batches for i in b])


def pos_weights(df: pd.DataFrame, cap: float, overrides: dict[str, float]) -> torch.Tensor:
    w = []
    for t in TARGETS_8:
        known = df[t][df[t] >= 0]
        pos, neg = int((known == 1).sum()), int((known == 0).sum())
        w.append(overrides.get(t, min(cap, neg / pos) if pos else 1.0))
    return torch.tensor(w, dtype=torch.float32)


def masked_bce(logits, labels, row_w, pos_w):
    mask = (labels >= 0).float() * row_w[:, None]
    loss = torch.nn.functional.binary_cross_entropy_with_logits(
        logits, labels.clamp(min=0), pos_weight=pos_w, reduction="none")
    return (loss * mask).sum() / mask.sum().clamp(min=1.0)


@torch.no_grad()
def checkin_probs(model, tok, texts, dev, max_len, masked_idx):
    model.eval()
    out = []
    for i in range(0, len(texts), 64):
        enc = tok(texts[i:i + 64], truncation=True, max_length=max_len, padding=True, return_tensors="pt").to(dev)
        out.append(torch.sigmoid(model(**enc).logits.float()).cpu().numpy())
    model.train()
    p = np.concatenate(out)
    p[:, masked_idx] = 0.0
    return p


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", required=True)
    ap.add_argument("--data", type=Path, default=ROOT / "data" / "processed")
    ap.add_argument("--model", default="j-hartmann/emotion-english-distilroberta-base")
    ap.add_argument("--epochs", type=float, default=4)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--lr", type=float, default=3e-5)
    ap.add_argument("--max-len", type=int, default=128)
    ap.add_argument("--pos-cap", type=float, default=8.0)
    ap.add_argument("--pos-override", default="", help="e.g. numbness=3,calm=5")
    ap.add_argument("--sources", default="", help="comma list to keep (default: all)")
    ap.add_argument("--mask", default="", help="comma list of heads to mask (no gradient, zeroed at eval)")
    ap.add_argument("--evals-per-epoch", type=int, default=4)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--grad-ckpt", action="store_true", help="recompute activations (large models on 16 GB)")
    ap.add_argument("--freeze-embeddings", action="store_true")
    args = ap.parse_args()

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    dev = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    out_dir = RUNS / args.tag
    out_dir.mkdir(parents=True, exist_ok=True)

    train_df = pd.read_csv(args.data / "train.csv")
    if args.sources:
        train_df = train_df[train_df["source"].isin(args.sources.split(","))]
    masked = [m for m in args.mask.split(",") if m]
    for m in masked:
        train_df[m] = -1
    masked_idx = [TARGETS_8.index(m) for m in masked]
    checkin_dev = load_eval("dev")

    tok = AutoTokenizer.from_pretrained(args.model)
    model = AutoModelForSequenceClassification.from_pretrained(
        args.model, num_labels=8, problem_type="multi_label_classification", ignore_mismatched_sizes=True,
        id2label={i: LABEL_NAMES[t] for i, t in enumerate(TARGETS_8)},
        label2id={LABEL_NAMES[t]: i for i, t in enumerate(TARGETS_8)}).to(dev)

    overrides = {k: float(v) for k, v in (kv.split("=") for kv in args.pos_override.split(",") if kv)}
    pw = pos_weights(train_df, args.pos_cap, overrides).to(dev)
    if args.grad_ckpt:
        model.gradient_checkpointing_enable()
    if args.freeze_embeddings:
        for p_ in model.base_model.embeddings.parameters():
            p_.requires_grad = False
    print(f"device {dev} | train rows {len(train_df):,} | sources {train_df['source'].value_counts().to_dict()}")
    print("pos_weight:", dict(zip(TARGETS_8, [round(x, 2) for x in pw.tolist()])))

    ds = Rows(train_df)
    lengths = [len(t) for t in ds.texts]

    def collate(batch):
        texts, labels, weights = zip(*batch)
        enc = tok(list(texts), truncation=True, max_length=args.max_len, padding=True, return_tensors="pt")
        return enc, torch.tensor(np.stack(labels)), torch.tensor(np.array(weights))

    loader = DataLoader(ds, batch_size=args.batch, sampler=LengthGrouped(lengths, args.batch, args.seed), collate_fn=collate)
    steps_per_epoch = len(loader)
    total = int(steps_per_epoch * args.epochs)
    opt = torch.optim.AdamW([p_ for p_ in model.parameters() if p_.requires_grad], lr=args.lr, weight_decay=0.01)
    sched = get_linear_schedule_with_warmup(opt, int(0.06 * total), total)
    eval_every = max(1, steps_per_epoch // args.evals_per_epoch)

    history, best, step, t0 = [], None, 0, time.time()
    model.train()
    done = False
    while not done:
        for enc, labels, weights in loader:
            enc = {k: v.to(dev) for k, v in enc.items()}
            loss = masked_bce(model(**enc).logits, labels.to(dev), weights.to(dev), pw)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step(); sched.step(); opt.zero_grad()
            step += 1
            if step % eval_every == 0 or step == total:
                probs = checkin_probs(model, tok, checkin_dev["text"].tolist(), dev, args.max_len, masked_idx)
                thr = best_threshold(probs, TARGETS_8, checkin_dev)
                s = score(probs, TARGETS_8, checkin_dev, thr)
                rec = {"step": step, "epoch": round(step / steps_per_epoch, 2), "loss": round(loss.item(), 4),
                       "top1": s["top1"], "top1_nonumb": s["top1_nonumb"], "macro_f1": s["macro_f1"],
                       "threshold": thr, "minutes": round((time.time() - t0) / 60, 1)}
                history.append(rec)
                key = (s["top1"], s["macro_f1"])
                mark = ""
                if best is None or key > best[0]:
                    best = (key, rec)
                    model.save_pretrained(out_dir)
                    tok.save_pretrained(out_dir)
                    mark = "  ← best, saved"
                print(json.dumps(rec) + mark, flush=True)
            if step >= total:
                done = True
                break

    cfg = {
        "tag": args.tag, "model_name": args.model, "max_len": args.max_len, "batch_size": args.batch,
        "lr": args.lr, "epochs": args.epochs, "seed": args.seed, "pos_weight": dict(zip(TARGETS_8, pw.tolist())),
        "targets_8": TARGETS_8, "supervised": [t for t in TARGETS_8 if t not in masked],
        "masked_unsupervised": masked, "train_rows": len(train_df), "sources": sorted(train_df["source"].unique()),
        "selected": best[1], "history": history,
        # Per-mood thresholds aren't used by Sonora's UI (it ranks moods), kept for reference.
        "thresholds": {t: best[1]["threshold"] for t in TARGETS_8 if t not in masked},
    }
    (out_dir / "config_training.json").write_text(json.dumps(cfg, indent=2))
    print("best:", json.dumps(best[1]))


if __name__ == "__main__":
    main()
