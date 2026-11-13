"""Distil a large fine-tuned teacher into the small browser model.

The 355M-parameter teacher understands indirect phrasing far better than the
82M student that fits in a browser (73% vs 63% top-1 on check-ins before any
fine-tuning). Here the student learns from:
  - the real labels, where a dataset has them (masked BCE, as in train.py), and
  - the teacher's probability for every mood on every sentence, which also
    fills in moods the datasets never annotate (stress/numbness on most rows),
  - plus a transfer set of extra first-person "i feel ..." posts that only the
    teacher labels, to show the student more check-in-like text.

Run:  .venv/bin/python distill.py --teacher runs/teacher_large --tag student_v5
"""

from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader
from transformers import AutoModelForSequenceClassification, AutoTokenizer, get_linear_schedule_with_warmup

from build_data import FEEL, norm
from eval_checkins import EVAL_CSV, TARGETS_8, best_threshold, load_eval, score
from train import LABEL_NAMES, LengthGrouped, checkin_probs, masked_bce, pos_weights

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"


def transfer_texts(n: int, exclude: set[str], seed: int = 7) -> list[str]:
    """First-person feeling posts from CARER that aren't already training rows."""
    df = pd.read_csv(DATA / "raw" / "carer_unsplit.csv")
    df = df[df["text"].str.contains(FEEL, regex=True)]
    df = df[~df["text"].map(norm).isin(exclude)]
    return df.sample(n=min(n, len(df)), random_state=seed)["text"].astype(str).tolist()


@torch.no_grad()
def teacher_probs(teacher_dir: Path, texts: list[str], dev, max_len: int = 128, batch: int = 64) -> np.ndarray:
    tok = AutoTokenizer.from_pretrained(teacher_dir)
    model = AutoModelForSequenceClassification.from_pretrained(teacher_dir).to(dev).eval()
    order = np.argsort([len(t) for t in texts])  # length-sorted for speed
    out = np.zeros((len(texts), 8), np.float32)
    t0 = time.time()
    for i in range(0, len(texts), batch):
        idx = order[i:i + batch]
        enc = tok([texts[j] for j in idx], truncation=True, max_length=max_len, padding=True, return_tensors="pt").to(dev)
        out[idx] = torch.sigmoid(model(**enc).logits.float()).cpu().numpy()
        if (i // batch) % 200 == 0:
            print(f"  teacher {i:,}/{len(texts):,} ({(time.time() - t0) / 60:.1f} min)", flush=True)
    del model
    torch.mps.empty_cache()
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--teacher", type=Path, required=True)
    ap.add_argument("--tag", required=True)
    ap.add_argument("--student", default="j-hartmann/emotion-english-distilroberta-base")
    ap.add_argument("--transfer", type=int, default=30000)
    ap.add_argument("--alpha", type=float, default=0.5, help="weight of the real-label loss (rest: teacher)")
    ap.add_argument("--epochs", type=float, default=2)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--lr", type=float, default=3e-5)
    ap.add_argument("--max-len", type=int, default=128)
    ap.add_argument("--mask", default="", help="heads to zero at evaluation and export")
    ap.add_argument("--sources", default="goemotions,empathetic,dreaddit,ed_opening,carer_rare",
                    help="training sources whose real labels are used (the best mix in the ablations)")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    torch.manual_seed(args.seed)
    dev = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    out_dir = ROOT / "runs" / args.tag
    out_dir.mkdir(parents=True, exist_ok=True)

    all_train = pd.read_csv(DATA / "processed" / "train.csv")
    train_df = all_train[all_train["source"].isin(args.sources.split(","))].reset_index(drop=True)
    banned = {norm(t) for t in pd.read_csv(EVAL_CSV, keep_default_na=False)["text"]}
    extra = transfer_texts(args.transfer, banned | set(all_train["text"].map(norm)))
    texts = train_df["text"].astype(str).tolist() + extra
    hard = np.concatenate([train_df[TARGETS_8].to_numpy(np.float32), -np.ones((len(extra), 8), np.float32)])
    weights = np.concatenate([train_df["weight"].to_numpy(np.float32), np.full(len(extra), 0.5, np.float32)])

    cache = DATA / f"teacher_{args.teacher.name}_{len(texts)}.npy"
    if cache.exists():
        soft = np.load(cache)
    else:
        print(f"labelling {len(texts):,} texts with the teacher…")
        soft = teacher_probs(args.teacher, texts, dev, args.max_len)
        np.save(cache, soft)
    print(f"rows {len(texts):,} ({len(extra):,} teacher-only) | teacher mean probs:",
          dict(zip(TARGETS_8, soft.mean(0).round(3).tolist())))

    masked = [m for m in args.mask.split(",") if m]
    masked_idx = [TARGETS_8.index(m) for m in masked]
    pw = pos_weights(train_df, 6.0, {"numbness": 3.0}).to(dev)

    tok = AutoTokenizer.from_pretrained(args.student)
    model = AutoModelForSequenceClassification.from_pretrained(
        args.student, num_labels=8, problem_type="multi_label_classification", ignore_mismatched_sizes=True,
        id2label={i: LABEL_NAMES[t] for i, t in enumerate(TARGETS_8)},
        label2id={LABEL_NAMES[t]: i for i, t in enumerate(TARGETS_8)}).to(dev)

    items = list(range(len(texts)))

    def collate(batch):
        enc = tok([texts[i] for i in batch], truncation=True, max_length=args.max_len, padding=True, return_tensors="pt")
        return enc, torch.tensor(hard[batch]), torch.tensor(soft[batch]), torch.tensor(weights[batch])

    loader = DataLoader(items, batch_size=args.batch, sampler=LengthGrouped([len(t) for t in texts], args.batch, args.seed),
                        collate_fn=collate)
    total = int(len(loader) * args.epochs)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    sched = get_linear_schedule_with_warmup(opt, int(0.06 * total), total)
    eval_every = max(1, len(loader) // 4)
    checkin_dev = load_eval("dev")

    history, best, step, t0 = [], None, 0, time.time()
    model.train()
    while step < total:
        for enc, y, s, w in loader:
            enc = {k: v.to(dev) for k, v in enc.items()}
            y, s, w = y.to(dev), s.to(dev), w.to(dev)
            logits = model(**enc).logits
            soft_loss = (torch.nn.functional.binary_cross_entropy_with_logits(logits, s, reduction="none").mean(1) * w).sum() / w.sum()
            has_hard = (y >= 0).any().item()
            loss = (1 - args.alpha) * soft_loss + (args.alpha * masked_bce(logits, y, w, pw) if has_hard else 0.0)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step(); sched.step(); opt.zero_grad()
            step += 1
            if step % eval_every == 0 or step == total:
                probs = checkin_probs(model, tok, checkin_dev["text"].tolist(), dev, args.max_len, masked_idx)
                thr = best_threshold(probs, TARGETS_8, checkin_dev)
                sc = score(probs, TARGETS_8, checkin_dev, thr)
                rec = {"step": step, "epoch": round(step / len(loader), 2), "loss": round(float(loss), 4),
                       "top1": sc["top1"], "top1_nonumb": sc["top1_nonumb"], "macro_f1": sc["macro_f1"],
                       "threshold": thr, "minutes": round((time.time() - t0) / 60, 1)}
                history.append(rec)
                mark = ""
                if best is None or (sc["top1"], sc["macro_f1"]) > best[0]:
                    best = ((sc["top1"], sc["macro_f1"]), rec)
                    model.save_pretrained(out_dir); tok.save_pretrained(out_dir)
                    mark = "  ← best, saved"
                print(json.dumps(rec) + mark, flush=True)
            if step >= total:
                break

    cfg = {"tag": args.tag, "model_name": args.student, "teacher": str(args.teacher), "alpha": args.alpha,
           "transfer_rows": len(extra), "max_len": args.max_len, "epochs": args.epochs, "lr": args.lr,
           "targets_8": TARGETS_8, "supervised": [t for t in TARGETS_8 if t not in masked],
           "masked_unsupervised": masked, "selected": best[1], "history": history,
           "thresholds": {t: best[1]["threshold"] for t in TARGETS_8 if t not in masked}}
    (out_dir / "config_training.json").write_text(json.dumps(cfg, indent=2))
    print("best:", json.dumps(best[1]))


if __name__ == "__main__":
    main()
