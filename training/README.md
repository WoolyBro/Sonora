# Training Sonora's emotion model

This folder is how the model in `public/models/sonora-emotion/` was made. It
builds on the carefully mapped corpus and the hand-written check-in evaluation
set from the `emotion-music-ai` project (read-only, at
`~/Desktop/Ideapad/VS/Python/Music/emotion-music-ai`). No third-party AI service
is used to label, train or run anything.

## Result

Scored on the hand-written check-in set (`checkin_eval_v1.csv`), which is the
only data written the way Sonora's users write. Models were chosen on its `dev`
half; the `test` half was opened once, at the end. Both rows are the shipped
int8 ONNX files.

| | Test top-1 (100 unseen) | Test mood-presence macro-F1 | Test numbness F1 | Dev top-1 (97) |
| --- | --- | --- | --- | --- |
| Previous model (`emotion_classifier_v2_v3`) | 62/100 | 0.436 | 0.00 (head disabled) | 50/97 |
| **New model (`student_v5`)** | **61/100** | **0.536** | **0.48** | **55/97** |

Honest summary: the headline (is the top mood right?) is unchanged within noise.
What improved is detecting *which* moods are present (+0.10 macro-F1 on unseen
check-ins, with higher precision for sadness, anxiety, anger and joy), and
**numbness now works** when it's worded plainly ("i just feel numb and empty all
the time" → Numb / Disconnected). Calm got slightly worse (F1 0.69 → 0.55).
Indirect descriptions ("food doesn't taste like much", "i watch things happen to
me like it's someone else") are still mostly missed.

## Data

| Source | Rows used | Labels | Licence |
| --- | --- | --- | --- |
| GoEmotions (Reddit) | 18k | human, mapped in `emotion-music-ai/src/labels.py` | Apache 2.0 |
| EmpatheticDialogues situations | 11k | human (the writer chose the emotion) | CC BY-NC 4.0 |
| **EmpatheticDialogues opening lines** (new) | 7.8k | same label as the conversation; first person, present tense | CC BY-NC 4.0 |
| Dreaddit (stress) | 2.5k | 5 human annotators per post | research use |
| **CARER "i feel …" posts, relabelled** (new) | 6.2k | stress / calm / numbness from the feeling word, see below | research/educational use |

**Licences:** EmpatheticDialogues and CARER are non-commercial / research use.
That's fine for a personal or academic project; if Sonora ever becomes a
commercial product, these sources (already used by the previous model too) need
replacing or permission.

### Why CARER is relabelled

CARER's own labels were assigned automatically from the feeling word, and they
contradict Sonora's moods: "stressed" is filed under anger or fear, "relaxed"
and "calm" under joy, "numb" and "empty" under sadness. Training on them would
teach exactly the confusions Sonora must avoid. `build_data.py` instead maps the
feeling word with an explicit list (`FEELING_WORDS`), keeps only stress, calm
and numbness (the moods with the least data), leaves ambiguous words out
("safe", "dull", "down", "restless"…), and counts these rows at half weight.

### Labelling rules that mattered

- A label is 1, 0, or UNKNOWN (-1, ignored by the loss). Corpora that never
  annotate stress or numbness leave them UNKNOWN rather than claiming 0.
- First attempt: the numbness head saw only "numb" vs UNKNOWN on every negative
  text, learned "negative = numb", and won 30 of 97 dev check-ins (12 are numb).
  Fix: numbness (flat, detached) can't co-occur with an active emotion, so rows
  labelled anxiety, anger, joy, connection or calm are numbness = 0, and a CARER
  post naming another feeling ("i feel sad") is not numb.
- Every check-in evaluation sentence is removed from training data.

## Experiments (dev check-ins, 97 rows)

| Run | Data | Dev top-1 (best / 2nd-half mean) | Notes |
| --- | --- | --- | --- |
| previous model | GoE + ED + Dreaddit | 50 | numbness disabled |
| `v4_base_control` | same data, new recipe | 53 / 51.4 | recipe alone ≈ no gain |
| `v4_all` | everything incl. SemEval-2018 + all CARER | 48 | numbness over-fired (labelling flaw) |
| `v4b` | everything, numbness fixed | 53 | common-mood CARER + SemEval tweets dilute check-in style |
| `v4c` | + ED opening lines | 49 | |
| `v4d` | + CARER stress/calm/numbness | 53 | best F1 so far |
| `v4e` | + both | 58 / 53.0 | 58 was a spike |
| `teacher_large` | v4e data, RoBERTa-large (355M) | 57 | too big for a browser |
| **`student_v5`** | v4e data + teacher's scores + 30k teacher-labelled CARER posts | **57 / 56.0** | steadiest; chosen |
| `adapt_checkins --cv` | tune on half the dev check-ins | 54–55 vs 57 | not adopted |

With 97 dev rows, ±3 check-ins is noise, so the choice was made on stability
across training as well as the peak. Distillation was the only change that
lifted the whole second half of training.

## Reproduce

```bash
cd training
python3 -m venv .venv && .venv/bin/pip install torch transformers datasets pandas scikit-learn onnx onnxruntime onnxscript numpy accelerate
.venv/bin/python -c "from datasets import load_dataset; load_dataset('dair-ai/emotion','unsplit')['train'].to_pandas().to_csv('data/raw/carer_unsplit.csv', index=False)"
.venv/bin/python build_data.py
# teacher (~80 min on an M5; gradient checkpointing keeps it inside 16 GB)
.venv/bin/python train.py --tag teacher_large --model j-hartmann/emotion-english-roberta-large \
  --sources goemotions,empathetic,dreaddit,ed_opening,carer_rare --epochs 1.5 --batch 16 --lr 1e-5 \
  --pos-cap 6 --pos-override numbness=3 --evals-per-epoch 6 --grad-ckpt --freeze-embeddings
# student (~30 min including labelling)
.venv/bin/python distill.py --teacher runs/teacher_large --tag student_v5 --epochs 2
.venv/bin/python eval_checkins.py --model runs/student_v5 --split test --per-class
# export for the browser (from the Sonora root)
cd .. && training/.venv/bin/python scripts/export_emotion_model.py --model training/runs/student_v5 \
  --eval ~/Desktop/Ideapad/VS/Python/Music/emotion-music-ai/data/annotations/checkin_eval_v1.csv \
  --out public/models/sonora-emotion
```

`data/`, `runs/` and `.venv/` are git-ignored (datasets and checkpoints are large).
SemEval-2018 (`build_data.py` still builds it, as `semeval`) was tested and left
out of the final mix.

## What would help most next

Public datasets don't read like check-ins, and every gain here was capped by
that. The single most valuable addition is **a few hundred more hand-labelled
check-ins**, especially indirect numbness ("i watch things happen like it's
someone else"), calm, and stress, written the way people actually type into
Sonora. With those, a short in-domain tune (`adapt_checkins.py`) becomes worth
it; with ~50 per fold it wasn't.
