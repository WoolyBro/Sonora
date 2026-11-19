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

## Intensity (`student_v6i`, the shipped model)

`student_v5` only answered *which* moods are present. Its sigmoid probabilities
sit at 0.95–0.99 for almost any clearly emotional text, and the app turned that
into intensity as `0.3 + 0.4 × top + 0.05`, so nearly every check-in read **73%**.

`student_v6i` adds a real intensity output, trained on human ratings:

- **Data:** SemEval-2018 Task 1 "Affect in Tweets", EI-reg (English). Tweets rated
  0–1 by crowd annotators (best–worst scaling) for the intensity of anger, fear,
  joy or sadness. 7.1k train / 1.6k dev / 4.1k test. Downloaded from the Hugging
  Face mirrors `Holmeister/ei_reg_{anger,fear,joy,sadness}`.
- **Head:** one linear layer, 768 → 4, sigmoid, on the mean of the final token
  states. Probing showed that an MLP or CLS features do no better
  (`intensity_probe.py`).
- **Frozen encoder first** (`intensity.py`): test Pearson 0.687, but the scores
  were squeezed together ("a little sad" ≈ "devastated", both 0.81). Features
  tuned for mood presence barely encode degree.
- **Joint tune** (`intensity_joint.py`): the top 3 encoder layers are tuned on
  EI-reg while a distillation loss holds the mood heads to `student_v5`'s own
  outputs, on 24k Sonora training texts and on the tweets. A checkpoint is kept
  only if dev check-in top-1 drops by no more than one row and it agrees with
  the teacher's top mood ≥ 93% of the time. Chosen: step 663 of 1772.

| | EI-reg test Pearson (mean of 4) | Check-in test top-1 (fp32) | Check-in all, int8 |
| --- | --- | --- | --- |
| `student_v5` + frozen head | 0.687 | 61/105 | 116/197 |
| **`student_v6i`** | **0.713** (anger 0.69, fear 0.73, joy 0.73, sadness 0.70) | **61/105** | **115/197** (per-channel int8) |

For reference, the SemEval-2018 baseline scored 0.520 and the best system 0.799.

In the browser:

- The graph has a second output, `intensity`, carrying anger, fear, joy and
  sadness.
- Each mood reads its closest affect (`AFFECT_FOR` in `src/lib/emotion/normalize.ts`).
  Stress uses the larger of fear and anger, numbness uses sadness, and warmth
  and calm use joy.
- The output is stretched from 0.25–0.90 to 0–1. That range covers roughly the
  5th to 95th percentile of the model's readings on the check-in set (stored as
  `intensity.calibration` in `sonora_meta.json`).
- Degree words then adjust the result (`applyDegree`). The tweets contain
  almost no hedges, so the model under-reacts to "a little" or "slightly". A
  hedge multiplies the reading by 0.55, and intensifiers lift it part of the way
  toward 1.

Resulting readings:

| Check-in | Intensity |
| --- | --- |
| "i'm a little sad today" | 44% |
| "i'm devastated, i can't stop crying…" | 83% |
| "a bit annoyed at my roommate" | 47% |
| "i'm furious, i want to scream…" | 99% |
| "today was nice" | 72% |
| "best day of my life!!!…" | 96% |

**Limits:**
- Tweets aren't check-ins, and there is no hand-rated check-in intensity set
  yet. A few hundred check-ins with a 0–1 intensity rating would allow proper
  calibration and an honest score.
- The NRC Emotion Intensity Lexicon (word-level human ratings, non-commercial)
  would be a natural addition for degree words, but it wasn't downloaded here.

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
# intensity: frozen-head probe and init, then the joint tune (~20 min), then export
.venv/bin/python intensity.py
.venv/bin/python intensity_joint.py --out runs/student_v6i
cd .. && training/.venv/bin/python scripts/export_emotion_model.py --model training/runs/student_v6i \
  --eval ~/Desktop/Ideapad/VS/Python/Music/emotion-music-ai/data/annotations/checkin_eval_v1.csv \
  --out public/models/sonora-emotion --calibration 0.25,0.9 --per-channel
```

The EI-reg parquet files go in `data/raw/ei_reg/` as `{emotion}_{split}.parquet`.

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
