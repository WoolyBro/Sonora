"""Quick probe: how well do the shipped classifier's frozen features predict
human-rated emotion intensity (SemEval-2018 Task 1 EI-reg)?

Compares three feature views of student_v5 with a ridge regressor per emotion,
scored by Pearson r on the official dev and test splits (the metric the shared
task used). Nothing here is shipped; it decides whether a frozen-encoder head is
good enough or whether the encoder needs tuning.
"""

from __future__ import annotations

import re
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from scipy.stats import pearsonr
from sklearn.linear_model import RidgeCV
from transformers import AutoModelForSequenceClassification, AutoTokenizer

HERE = Path(__file__).parent
RAW = HERE / "data" / "raw" / "ei_reg"
EMOS = ["anger", "fear", "joy", "sadness"]


def clean(t: str) -> str:
    t = re.sub(r"https?://\S+", "", t)
    t = re.sub(r"@\w+", "@user", t)
    t = t.replace("#", "")
    return re.sub(r"\s+", " ", t).strip()


def load(split: str) -> pd.DataFrame:
    parts = []
    for e in EMOS:
        d = pd.read_parquet(RAW / f"{e}_{split}.parquet")
        parts.append(pd.DataFrame({"text": d["input"].map(clean), "emo": e, "y": d["output"]}))
    return pd.concat(parts, ignore_index=True)


@torch.no_grad()
def features(texts: list[str], tok, model, device) -> dict[str, np.ndarray]:
    out = {"cls": [], "pooled": [], "mean": [], "logits": []}
    for i in range(0, len(texts), 64):
        enc = tok(texts[i : i + 64], truncation=True, max_length=128, padding=True, return_tensors="pt").to(device)
        h = model.roberta(**enc).last_hidden_state
        cls = h[:, 0]
        pooled = torch.tanh(model.classifier.dense(cls))
        m = enc["attention_mask"].unsqueeze(-1).float()
        mean = (h * m).sum(1) / m.sum(1)
        logits = model.classifier.out_proj(pooled)
        for k, v in zip(out, (cls, pooled, mean, logits)):
            v_np = v.float().cpu().numpy()
            out[k].append(v_np)
    return {k: np.concatenate(v) for k, v in out.items()}


def main() -> None:
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    mdir = HERE / "runs" / "student_v5"
    tok = AutoTokenizer.from_pretrained(mdir)
    model = AutoModelForSequenceClassification.from_pretrained(mdir).to(device).eval()
    data = {s: load(s) for s in ("train", "validation", "test")}
    feats = {s: features(d["text"].tolist(), tok, model, device) for s, d in data.items()}
    np.savez(HERE / "data" / "ei_reg_feats.npz", **{f"{s}_{k}": v for s, f in feats.items() for k, v in f.items()})

    for view in ("logits", "cls", "pooled", "mean"):
        rs = {"validation": [], "test": []}
        for e in EMOS:
            tr = data["train"]["emo"].values == e
            reg = RidgeCV(alphas=np.logspace(-2, 3, 12)).fit(feats["train"][view][tr], data["train"]["y"].values[tr])
            for s in rs:
                m = data[s]["emo"].values == e
                rs[s].append(pearsonr(reg.predict(feats[s][view][m]), data[s]["y"].values[m])[0])
        print(f"{view:7s} dev r={np.mean(rs['validation']):.3f}  test r={np.mean(rs['test']):.3f}  per-emo test {np.round(rs['test'], 3)}")


if __name__ == "__main__":
    main()
