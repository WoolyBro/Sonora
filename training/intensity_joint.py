"""Teach the shared encoder *how strongly* something is felt, without changing
*what* it thinks is felt.

intensity.py showed a head on the frozen encoder ranks texts sensibly but with
a narrow spread ("a little sad" ~ "devastated"): features tuned for mood
presence barely encode degree. Here the top encoder layers are tuned on the
SemEval-2018 EI-reg intensity ratings while a distillation loss pins the mood
classifier to the shipped model's own outputs (student_v5 as teacher) on
Sonora's training texts and on the tweets. One encoder still serves both heads,
so the browser download stays the same size.

Model choice uses only EI-reg dev and the dev half of the check-in set
(top-1 must not drop) plus agreement with the teacher's top mood. EI-reg test
and the check-in test half are scored once for the report.

    .venv/bin/python intensity_joint.py --out runs/student_v6i
"""

from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from scipy.stats import pearsonr
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from eval_checkins import load_eval
from intensity_probe import EMOS, HERE, load

TEACHER = HERE / "runs" / "student_v5"
MAX_LEN = 128

# Diagnostic only (never used for selection): does the score move with degree?
GRADED = [
    ("i'm a little sad today", "i feel really sad and lonely tonight", "i'm devastated, i can't stop crying and nothing feels worth it"),
    ("slightly nervous about tomorrow", "i'm worried about my exam results", "i'm terrified, my heart is pounding and i can't stop panicking"),
    ("a bit annoyed at my roommate", "i'm really frustrated with how work went", "i'm furious, i want to scream, i can't believe they did this"),
    ("today was nice", "i'm really happy, the weekend went great", "best day of my life!!! i got in, i'm over the moon"),
]


class WithIntensity(nn.Module):
    def __init__(self, clf: nn.Module):
        super().__init__()
        self.clf = clf
        self.intensity = nn.Linear(clf.config.hidden_size, len(EMOS))

    def forward(self, input_ids, attention_mask):
        h = self.clf.roberta(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
        logits = self.clf.classifier(h)
        m = attention_mask.unsqueeze(-1).to(h.dtype)
        mean = (h * m).sum(1) / m.sum(1)
        return logits, self.intensity(mean)  # intensity as logits; sigmoid at use


def batches(n: int, size: int, rng: np.random.Generator):
    while True:
        perm = rng.permutation(n)
        for i in range(0, n - size + 1, size):
            yield perm[i : i + size]


@torch.no_grad()
def run(model: WithIntensity, tok, texts: list[str], dev) -> tuple[np.ndarray, np.ndarray]:
    model.eval()
    L, I = [], []
    for i in range(0, len(texts), 64):
        enc = tok(texts[i : i + 64], truncation=True, max_length=MAX_LEN, padding=True, return_tensors="pt").to(dev)
        lg, it = model(enc["input_ids"], enc["attention_mask"])
        L.append(lg.float().cpu().numpy())
        I.append(torch.sigmoid(it).float().cpu().numpy())
    return np.concatenate(L), np.concatenate(I)


def ei_pearson(I: np.ndarray, df: pd.DataFrame) -> tuple[float, dict]:
    rs = {}
    for j, e in enumerate(EMOS):
        m = df["emo"].values == e
        rs[e] = float(pearsonr(I[m, j], df["y"].values[m])[0])
    return float(np.mean(list(rs.values()))), rs


def checkin_top1(L: np.ndarray, df: pd.DataFrame, order: list[str]) -> int:
    hits = 0
    for row, lg in zip(df.itertuples(), L):
        hits += order[int(lg.argmax())] in row.labels
    return hits


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=HERE / "runs" / "student_v6i")
    ap.add_argument("--epochs", type=float, default=4)
    ap.add_argument("--train-layers", type=int, default=3, help="top encoder layers to tune")
    ap.add_argument("--lr", type=float, default=3e-5)
    ap.add_argument("--w-int", type=float, default=10.0, help="weight of the intensity MSE")
    ap.add_argument("--distill-rows", type=int, default=24000)
    args = ap.parse_args()

    torch.manual_seed(0)
    rng = np.random.default_rng(0)
    dev = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
    tok = AutoTokenizer.from_pretrained(TEACHER)
    # eager attention: MPS scaled_dot_product_attention has no dropout support
    teacher = AutoModelForSequenceClassification.from_pretrained(TEACHER, attn_implementation="eager").to(dev).eval()
    order = [teacher.config.id2label[i] for i in range(teacher.config.num_labels)]
    label_to_key = {"sadness": "LOW_SAD", "anxiety": "ANXIOUS_WORRIED", "anger": "ANGRY_FRUSTRATED",
                    "stress": "STRESSED_OVERWHELMED", "numbness": "NUMB_DISCONNECTED", "joy": "POSITIVE_JOYFUL",
                    "connection": "AFFECTIONATE_CONNECTED", "calm": "CALM_PEACEFUL"}

    ei = {s: load(s) for s in ("train", "validation", "test")}
    sonora = pd.read_csv(HERE / "data" / "processed" / "train.csv")
    distill_texts = sonora.sample(n=min(args.distill_rows, len(sonora)), random_state=0)["text"].astype(str).tolist()
    agree_texts = pd.read_csv(HERE / "data" / "processed" / "dev.csv").sample(n=2000, random_state=0)["text"].astype(str).tolist()
    ck = {s: load_eval(s) for s in ("dev", "test")}
    for df in ck.values():
        df["labels"] = df["labels"].apply(lambda ls: {label_to_key[x] for x in ls})

    # Teacher targets: the shipped model's own mood probabilities.
    base = WithIntensity(teacher).to(dev)
    head = torch.load(TEACHER / "intensity_head.pt")
    base.intensity.weight.data.copy_(head["weight"])
    base.intensity.bias.data.copy_(head["bias"])
    t_distill = torch.sigmoid(torch.tensor(run(base, tok, distill_texts, dev)[0]))
    t_ei = torch.sigmoid(torch.tensor(run(base, tok, ei["train"]["text"].tolist(), dev)[0]))
    t_agree = run(base, tok, agree_texts, dev)[0].argmax(1)
    base_ck_dev = checkin_top1(run(base, tok, ck["dev"]["text"].tolist(), dev)[0], ck["dev"], order)
    print(f"teacher: check-in dev top-1 {base_ck_dev}/{len(ck['dev'])}")

    model = copy.deepcopy(base)
    n_layers = model.clf.config.num_hidden_layers
    for p in model.parameters():
        p.requires_grad = False
    for layer in model.clf.roberta.encoder.layer[n_layers - args.train_layers :]:
        for p in layer.parameters():
            p.requires_grad = True
    for p in list(model.clf.classifier.parameters()) + list(model.intensity.parameters()):
        p.requires_grad = True
    params = [p for p in model.parameters() if p.requires_grad]
    opt = torch.optim.AdamW(params, lr=args.lr, weight_decay=0.01)
    steps_per_epoch = len(ei["train"]) // 16
    total = int(args.epochs * steps_per_epoch)
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1.0, s / 100) * max(0.0, 1 - s / total))

    ei_idx = batches(len(ei["train"]), 16, rng)
    ds_idx = batches(len(distill_texts), 16, rng)
    emo_id = torch.tensor(ei["train"]["emo"].map({e: i for i, e in enumerate(EMOS)}).values)
    y_ei = torch.tensor(ei["train"]["y"].values, dtype=torch.float32)

    best, history = None, []
    eval_every = steps_per_epoch // 2
    for step in range(1, total + 1):
        model.train()
        a, b = next(ei_idx), next(ds_idx)
        texts = [ei["train"]["text"].iat[i] for i in a] + [distill_texts[i] for i in b]
        enc = tok(texts, truncation=True, max_length=MAX_LEN, padding=True, return_tensors="pt").to(dev)
        logits, it = model(enc["input_ids"], enc["attention_mask"])
        target = torch.cat([t_ei[a], t_distill[b]]).to(dev)
        l_mood = F.binary_cross_entropy_with_logits(logits, target)
        p_int = torch.sigmoid(it[: len(a)]).gather(1, emo_id[a][:, None].to(dev))[:, 0]
        l_int = F.mse_loss(p_int, y_ei[a].to(dev))
        loss = l_mood + args.w_int * l_int
        opt.zero_grad()
        loss.backward()
        torch.nn.utils.clip_grad_norm_(params, 1.0)
        opt.step()
        sched.step()

        if step % eval_every == 0 or step == total:
            _, I = run(model, tok, ei["validation"]["text"].tolist(), dev)
            r_dev, _ = ei_pearson(I, ei["validation"])
            ck_dev = checkin_top1(run(model, tok, ck["dev"]["text"].tolist(), dev)[0], ck["dev"], order)
            agree = float((run(model, tok, agree_texts, dev)[0].argmax(1) == t_agree).mean())
            rec = {"step": step, "ei_dev_r": round(r_dev, 3), "checkin_dev_top1": ck_dev, "teacher_agreement": round(agree, 3)}
            history.append(rec)
            print(rec, flush=True)
            ok = ck_dev >= base_ck_dev - 1 and agree >= 0.93
            if ok and (best is None or r_dev > best[0]):
                best = (r_dev, copy.deepcopy(model.state_dict()), rec)

    if best is None:
        raise SystemExit("no checkpoint kept the mood classifier intact; nothing saved")
    model.load_state_dict(best[1])

    # One-time report on held-out data.
    _, I = run(model, tok, ei["test"]["text"].tolist(), dev)
    r_test, r_test_per = ei_pearson(I, ei["test"])
    ck_test = checkin_top1(run(model, tok, ck["test"]["text"].tolist(), dev)[0], ck["test"], order)
    base_ck_test = checkin_top1(run(base, tok, ck["test"]["text"].tolist(), dev)[0], ck["test"], order)
    graded = []
    for trio, head_ix in zip(GRADED, (EMOS.index("sadness"), EMOS.index("fear"), EMOS.index("anger"), EMOS.index("joy"))):
        _, I = run(model, tok, list(trio), dev)
        graded.append([round(float(I[k, head_ix]), 2) for k in range(3)])

    args.out.mkdir(parents=True, exist_ok=True)
    model.clf.save_pretrained(args.out)
    tok.save_pretrained(args.out)
    cfg = json.loads((TEACHER / "config_training.json").read_text())
    (args.out / "config_training.json").write_text(json.dumps(cfg, indent=2))
    torch.save({"weight": model.intensity.weight.detach().cpu(), "bias": model.intensity.bias.detach().cpu(),
                "outputs": EMOS, "pooling": "mean"}, args.out / "intensity_head.pt")
    report = {
        "chosen": best[2],
        "ei_test_pearson_mean": round(r_test, 3),
        "ei_test_pearson": {e: round(v, 3) for e, v in r_test_per.items()},
        "checkin_test_top1": f"{ck_test}/{len(ck['test'])} (teacher {base_ck_test})",
        "graded_low_mid_high (diagnostic)": dict(zip(["sad", "anxious", "angry", "joy"], graded)),
        "args": {k: str(v) for k, v in vars(args).items()},
        "history": history,
    }
    (args.out / "intensity_report.json").write_text(json.dumps(report, indent=2))
    print(json.dumps({k: v for k, v in report.items() if k != "history"}, indent=2))


if __name__ == "__main__":
    main()
