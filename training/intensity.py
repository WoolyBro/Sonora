"""Train Sonora's intensity head.

The mood classifier answers *which* feelings are present (sigmoid presence
probabilities). Those saturate near 1 for almost any clearly emotional text, so
they can't say *how strongly* something is felt. This adds a separate, small
regression head trained on human intensity ratings:

  SemEval-2018 Task 1 "Affect in Tweets", EI-reg (English): tweets rated 0–1 for
  the intensity of anger, fear, joy or sadness by crowd annotators using
  best–worst scaling (Mohammad et al., 2018). ~7k train / 1.5k dev / 4k test.

The head reads the *frozen* student_v5 encoder (mean of the final token
states), so the mood classifier's outputs are untouched. It's one linear layer
(768 -> 4) with a sigmoid; feature standardisation is folded into its weights so
the exported graph needs no extra ops. Probing (intensity_probe.py) found an MLP
or CLS features no better than this.

Epochs are chosen on dev; test is scored once and reported.

    .venv/bin/python intensity.py   # writes runs/student_v5/intensity_head.pt
"""

from __future__ import annotations

import json

import numpy as np
import torch
import torch.nn as nn
from scipy.stats import pearsonr
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from intensity_probe import EMOS, HERE, features, load

RUN = HERE / "runs" / "student_v5"


def main() -> None:
    torch.manual_seed(0)
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    tok = AutoTokenizer.from_pretrained(RUN)
    model = AutoModelForSequenceClassification.from_pretrained(RUN).to(device).eval()
    data = {s: load(s) for s in ("train", "validation", "test")}
    X = {s: torch.tensor(features(d["text"].tolist(), tok, model, device)["mean"]) for s, d in data.items()}
    y = {s: torch.tensor(d["y"].values, dtype=torch.float32) for s, d in data.items()}
    k = {s: torch.tensor(d["emo"].map({e: i for i, e in enumerate(EMOS)}).values) for s, d in data.items()}

    mu, sd = X["train"].mean(0), X["train"].std(0) + 1e-6
    Z = {s: (x - mu) / sd for s, x in X.items()}

    head = nn.Linear(768, len(EMOS))
    drop = nn.Dropout(0.1)
    opt = torch.optim.AdamW(head.parameters(), lr=1e-3, weight_decay=0.05)

    def score(s: str) -> tuple[float, list[float]]:
        with torch.no_grad():
            p = torch.sigmoid(head(Z[s])).gather(1, k[s][:, None])[:, 0].numpy()
        rs = [float(pearsonr(p[k[s].numpy() == i], y[s].numpy()[k[s].numpy() == i])[0]) for i in range(len(EMOS))]
        return float(np.mean(rs)), rs

    best = (-1.0, None, 0)
    for ep in range(200):
        perm = torch.randperm(len(y["train"]))
        for i in range(0, len(perm), 128):
            b = perm[i : i + 128]
            p = torch.sigmoid(head(drop(Z["train"][b]))).gather(1, k["train"][b, None])[:, 0]
            loss = ((p - y["train"][b]) ** 2).mean()
            opt.zero_grad()
            loss.backward()
            opt.step()
        r, _ = score("validation")
        if r > best[0]:
            best = (r, {n: t.detach().clone() for n, t in head.state_dict().items()}, ep + 1)
    head.load_state_dict(best[1])
    dev_r, _ = score("validation")
    test_r, test_per = score("test")

    # Fold standardisation into the layer: W·((x-mu)/sd) + b = (W/sd)·x + (b - W·(mu/sd))
    W = head.weight.detach() / sd
    b = head.bias.detach() - (head.weight.detach() * (mu / sd)).sum(1)
    torch.save({"weight": W, "bias": b, "outputs": EMOS, "pooling": "mean"}, RUN / "intensity_head.pt")
    report = {
        "data": "SemEval-2018 Task 1 EI-reg (English)",
        "epochs": best[2],
        "dev_pearson_mean": round(dev_r, 3),
        "test_pearson_mean": round(test_r, 3),
        "test_pearson": {e: round(r, 3) for e, r in zip(EMOS, test_per)},
        "reference": "SemEval-2018 official baseline 0.520, best system 0.799 (avg Pearson, EI-reg English)",
    }
    (RUN / "intensity_report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
