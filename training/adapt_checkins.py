"""Short in-domain tune on hand-written check-ins.

Public datasets don't read like check-ins ("today was a lot", "food doesn't
taste like much these days"). This continues training a finished model on the
check-in DEV split (repeated, mixed with a slice of the original training rows
so it doesn't forget) at a low learning rate. The test split is never used here.

  --cv     2-fold cross-validation inside dev: tune on one half, score the other,
           against the starting model on the same rows. Tells us whether it
           helps without spending the test split.
  default  tune on all of dev and save to runs/<tag> (then evaluate on test once).
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from eval_checkins import TARGETS_8, load_eval, score
from train import checkin_probs, masked_bce, pos_weights

ROOT = Path(__file__).resolve().parent


def checkin_rows(df: pd.DataFrame) -> pd.DataFrame:
    rows = pd.DataFrame({"text": df["text"]})
    for t in TARGETS_8:
        rows[t] = df["labels"].apply(lambda l: int(t in l))
    rows["weight"] = np.where(df["uncertain"].astype(str) == "1", 0.5, 1.0)  # annotator was unsure
    return rows


def tune(start: Path, checkins: pd.DataFrame, args, dev) -> tuple:
    tok = AutoTokenizer.from_pretrained(start)
    model = AutoModelForSequenceClassification.from_pretrained(start).to(dev)
    train = pd.read_csv(ROOT / "data" / "processed" / "train.csv")
    train = train[train["source"].isin(args.sources.split(","))]
    replay = train.sample(n=args.replay, random_state=args.seed)
    mix = pd.concat([checkin_rows(checkins)] * args.repeat + [replay[["text", "weight"] + TARGETS_8]], ignore_index=True)
    mix = mix.sample(frac=1.0, random_state=args.seed).reset_index(drop=True)
    pw = pos_weights(train, 6.0, {"numbness": 3.0}).to(dev)

    def collate(idx):
        b = mix.iloc[idx]
        enc = tok(b["text"].tolist(), truncation=True, max_length=128, padding=True, return_tensors="pt")
        return enc, torch.tensor(b[TARGETS_8].to_numpy(np.float32)), torch.tensor(b["weight"].to_numpy(np.float32))

    loader = DataLoader(list(range(len(mix))), batch_size=16, shuffle=True, collate_fn=collate,
                        generator=torch.Generator().manual_seed(args.seed))
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    model.train()
    for _ in range(args.epochs):
        for enc, y, w in loader:
            enc = {k: v.to(dev) for k, v in enc.items()}
            loss = masked_bce(model(**enc).logits, y.to(dev), w.to(dev), pw)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step(); opt.zero_grad()
    return model, tok


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=Path, default=ROOT / "runs" / "student_v5")
    ap.add_argument("--tag", default="student_v5_adapted")
    ap.add_argument("--cv", action="store_true")
    ap.add_argument("--repeat", type=int, default=8)
    ap.add_argument("--replay", type=int, default=3000)
    ap.add_argument("--epochs", type=int, default=1)
    ap.add_argument("--lr", type=float, default=1e-5)
    ap.add_argument("--sources", default="goemotions,empathetic,dreaddit,ed_opening,carer_rare")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    torch.manual_seed(args.seed)
    dev = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    checkin_dev = load_eval("dev")
    cfg = json.loads((args.start / "config_training.json").read_text())
    masked_idx = [TARGETS_8.index(m) for m in cfg.get("masked_unsupervised", [])]
    thr = cfg["selected"]["threshold"]

    if args.cv:
        rng = np.random.RandomState(args.seed)
        fold = rng.permutation(len(checkin_dev)) % 2
        base_tok = AutoTokenizer.from_pretrained(args.start)
        base = AutoModelForSequenceClassification.from_pretrained(args.start).to(dev)
        totals = {"base_hits": 0, "tuned_hits": 0, "rows": 0, "base_f1": [], "tuned_f1": []}
        for k in (0, 1):
            fit, held = checkin_dev[fold != k].reset_index(drop=True), checkin_dev[fold == k].reset_index(drop=True)
            model, tok = tune(args.start, fit, args, dev)
            for name, m, t in (("base", base, base_tok), ("tuned", model, tok)):
                p = checkin_probs(m, t, held["text"].tolist(), dev, 128, masked_idx)
                s = score(p, TARGETS_8, held, thr)
                totals[f"{name}_hits"] += int(s["top1_hits"].split("/")[0])
                totals[f"{name}_f1"].append(s["macro_f1"])
            totals["rows"] += int((held["labels"].apply(len) > 0).sum())
            del model
            torch.mps.empty_cache()
        print(json.dumps({"repeat": args.repeat, "epochs": args.epochs, "lr": args.lr,
                          "base_top1": f"{totals['base_hits']}/{totals['rows']}",
                          "tuned_top1": f"{totals['tuned_hits']}/{totals['rows']}",
                          "base_macro_f1": round(float(np.mean(totals["base_f1"])), 3),
                          "tuned_macro_f1": round(float(np.mean(totals["tuned_f1"])), 3)}))
        return

    model, tok = tune(args.start, checkin_dev, args, dev)
    out = ROOT / "runs" / args.tag
    out.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(out)
    tok.save_pretrained(out)
    cfg.update({"tag": args.tag, "adapted_from": str(args.start), "adapt": vars(args) | {"start": str(args.start)}})
    (out / "config_training.json").write_text(json.dumps(cfg, indent=2, default=str))
    print("saved", out)


if __name__ == "__main__":
    main()
