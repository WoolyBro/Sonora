"""Export the trained Sonora emotion classifier to a quantized ONNX model that
runs in the browser (transformers.js / onnxruntime-web).

Why: Vercel can't host a persistent PyTorch server, and a 313 MB fp32
checkpoint is too heavy to ship. Dynamic int8 quantization brings the
DistilRoBERTa model to roughly a quarter of the size with near-identical
outputs. This script verifies that claim on the hand-written check-in eval set
rather than assuming it.

Usage:
    python scripts/export_emotion_model.py \
        --model ../VS/Python/Music/emotion-music-ai/models/emotion_classifier_v2_v3 \
        --eval  ../VS/Python/Music/emotion-music-ai/data/annotations/checkin_eval_v1.csv \
        --out   public/models/sonora-emotion

Requires: torch, transformers, onnx, onnxruntime, onnxscript, numpy.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import shutil
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch
from onnxruntime.quantization import QuantType, quantize_dynamic
from transformers import AutoModelForSequenceClassification, AutoTokenizer

# Classifier head order -> Sonora taxonomy keys.
MODEL_TO_SONORA = {
    "sadness": "LOW_SAD",
    "anxiety": "ANXIOUS_WORRIED",
    "anger": "ANGRY_FRUSTRATED",
    "stress": "STRESSED_OVERWHELMED",
    "numbness": "NUMB_DISCONNECTED",
    "joy": "POSITIVE_JOYFUL",
    "connection": "AFFECTIONATE_CONNECTED",
    "calm": "CALM_PEACEFUL",
}
MAX_LEN = 128


class WithIntensity(torch.nn.Module):
    """Classifier plus the intensity head (training/intensity_joint.py): one
    encoder, two outputs. `logits` are the mood heads as before; `intensity` is
    0-1 per rated affect (anger, fear, joy, sadness) from the mean token state."""

    def __init__(self, clf: torch.nn.Module, head: dict):
        super().__init__()
        self.clf = clf
        self.head = torch.nn.Linear(head["weight"].shape[1], head["weight"].shape[0])
        self.head.weight.data.copy_(head["weight"])
        self.head.bias.data.copy_(head["bias"])

    def forward(self, input_ids, attention_mask):
        h = self.clf.roberta(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
        logits = self.clf.classifier(h)
        m = attention_mask.unsqueeze(-1).to(h.dtype)
        mean = (h * m).sum(1) / m.sum(1)
        return logits, torch.sigmoid(self.head(mean))


def load_model(model_dir: Path) -> tuple[torch.nn.Module, dict | None]:
    clf = AutoModelForSequenceClassification.from_pretrained(model_dir).eval()
    head_path = model_dir / "intensity_head.pt"
    if not head_path.exists():
        return clf, None
    head = torch.load(head_path)
    return WithIntensity(clf, head).eval(), head


def sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def export(model_dir: Path, out_dir: Path, calibration: tuple[float, float] | None = None, per_channel: bool = False) -> Path:
    onnx_dir = out_dir / "onnx"
    onnx_dir.mkdir(parents=True, exist_ok=True)
    fp32_path = onnx_dir / "model.onnx"

    tok = AutoTokenizer.from_pretrained(model_dir)
    model, head = load_model(model_dir)

    sample = tok(["a short sample sentence", "another one"], padding=True, return_tensors="pt")
    batch = torch.export.Dim("batch")
    seq = torch.export.Dim("sequence", max=MAX_LEN)

    torch.onnx.export(
        model,
        (sample["input_ids"], sample["attention_mask"]),
        str(fp32_path),
        input_names=["input_ids", "attention_mask"],
        output_names=["logits", "intensity"] if head else ["logits"],
        dynamic_shapes={"input_ids": {0: batch, 1: seq}, "attention_mask": {0: batch, 1: seq}},
        dynamo=True,
        external_data=False,
    )

    # The dynamo exporter can leave stale intermediate shape annotations that
    # make onnx shape inference (run inside quantize_dynamic) fail. They're
    # optional metadata, so drop them and let inference recompute.
    graph_model = onnx.load(str(fp32_path))
    del graph_model.graph.value_info[:]
    onnx.save(graph_model, str(fp32_path))

    q8_path = onnx_dir / "model_quantized.onnx"
    quantize_dynamic(str(fp32_path), str(q8_path), weight_type=QuantType.QInt8, per_channel=per_channel)
    fp32_path.unlink()  # only the quantized model ships
    for extra in onnx_dir.glob("*.data"):
        extra.unlink()

    for name in ("config.json", "tokenizer.json", "tokenizer_config.json",
                 "special_tokens_map.json", "vocab.json", "merges.txt"):
        src = model_dir / name
        if src.exists():
            shutil.copy(src, out_dir / name)

    training = json.loads((model_dir / "config_training.json").read_text())
    meta = {
        "source_checkpoint": model_dir.name,
        "base_model": training.get("model_name"),
        "head_order": [MODEL_TO_SONORA[h] for h in training["targets_8"]],
        "masked_heads": [MODEL_TO_SONORA[h] for h in training["masked_unsupervised"]],
        # Per-class thresholds tuned on dev; used for "secondary emotion" calls.
        "thresholds": {MODEL_TO_SONORA[k]: v for k, v in training.get("thresholds", {}).items()},
        "max_len": MAX_LEN,
        "output": "sigmoid presence probabilities (multi-label), not calibrated intensity",
        **({"intensity": {
            "outputs": list(head["outputs"]),
            "data": "SemEval-2018 Task 1 EI-reg (human best-worst-scaled intensity ratings)",
            **({"calibration": {"lo": calibration[0], "hi": calibration[1]}} if calibration else {}),
        }} if head else {}),
        "files": file_manifest(out_dir),
    }
    (out_dir / "sonora_meta.json").write_text(json.dumps(meta, indent=2))
    return q8_path


def file_manifest(out_dir: Path) -> dict:
    """Byte size and SHA-256 of every shipped file. The browser uses the size for
    download progress (CDNs often compress and drop Content-Length) and the hash
    as its cache key, so a re-exported model is never served stale."""
    files = {}
    for path in sorted(out_dir.rglob("*")):
        rel = path.relative_to(out_dir).as_posix()
        if path.is_file() and rel not in ("sonora_meta.json", "export_report.json"):
            files[rel] = {"bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    return files


def verify(model_dir: Path, q8_path: Path, eval_csv: Path | None, out_dir: Path) -> dict:
    tok = AutoTokenizer.from_pretrained(model_dir)
    torch_model, head = load_model(model_dir)
    session = ort.InferenceSession(str(q8_path), providers=["CPUExecutionProvider"])
    meta = json.loads((out_dir / "sonora_meta.json").read_text())
    order = meta["head_order"]
    masked = set(meta["masked_heads"])

    rows = []
    if eval_csv and eval_csv.exists():
        with eval_csv.open() as f:
            rows = list(csv.DictReader(f))
    texts = [r["text"] for r in rows] or ["I can't switch off after work", "today felt light and easy"]

    max_diff = 0.0
    max_int_diff = 0.0
    hits_t, hits_q, scored = 0, 0, 0
    for i, text in enumerate(texts):
        enc = tok(text, truncation=True, max_length=MAX_LEN, return_tensors="pt")
        with torch.no_grad():
            out_t = torch_model(enc["input_ids"], enc["attention_mask"])
        logits_t = out_t[0] if head else out_t.logits
        p_t = sigmoid(logits_t[0].numpy())
        out_q = session.run(None, {
            "input_ids": enc["input_ids"].numpy(),
            "attention_mask": enc["attention_mask"].numpy(),
        })
        p_q = sigmoid(out_q[0][0])
        if head:
            max_int_diff = max(max_int_diff, float(np.abs(out_t[1][0].numpy() - out_q[1][0]).max()))
        for j, key in enumerate(order):
            if key in masked:
                p_t[j] = p_q[j] = 0.0
        max_diff = max(max_diff, float(np.abs(p_t - p_q).max()))

        if rows:
            gold = {MODEL_TO_SONORA[e.strip()] for e in rows[i]["emotions"].split(";") if e.strip()}
            if gold:
                scored += 1
                hits_t += order[int(p_t.argmax())] in gold
                hits_q += order[int(p_q.argmax())] in gold

    report = {
        "quantized_size_mb": round(q8_path.stat().st_size / 1e6, 1),
        "max_abs_prob_diff_vs_fp32": round(max_diff, 4),
        **({"max_abs_intensity_diff_vs_fp32": round(max_int_diff, 4)} if head else {}),
        "checkin_rows_scored": scored,
        "top1_fp32": f"{hits_t}/{scored}" if scored else None,
        "top1_int8": f"{hits_q}/{scored}" if scored else None,
    }
    (out_dir / "export_report.json").write_text(json.dumps(report, indent=2))
    return report


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", type=Path, required=True)
    ap.add_argument("--eval", type=Path, default=None)
    ap.add_argument("--out", type=Path, default=Path("public/models/sonora-emotion"))
    ap.add_argument("--calibration", type=str, default=None,
                    help="lo,hi: the browser maps intensity v to (v-lo)/(hi-lo)")
    ap.add_argument("--per-channel", action="store_true", help="per-channel int8 weights (less quantization error)")
    args = ap.parse_args()

    cal = tuple(float(x) for x in args.calibration.split(",")) if args.calibration else None
    q8 = export(args.model, args.out, cal, args.per_channel)
    print(json.dumps(verify(args.model, q8, args.eval, args.out), indent=2))


if __name__ == "__main__":
    main()
