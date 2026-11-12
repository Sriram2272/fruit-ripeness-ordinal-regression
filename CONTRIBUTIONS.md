# Team Contributions

**Project:** Fruit Ripeness Grading via Ordinal Regression
**Team:** Prajithaa · Dama Sriram · Nikhil

The project is divided into three parts of roughly equal size. Each member owns one part: they are responsible
for it, present it, and answer viva questions on it. The discussion, conclusion and rehearsal are shared.

## Overview

| Part | Owner | What the part covers | Share |
|---|---|---|---|
| **A. Data pipeline & results analysis** | **Prajithaa** | Data preparation code, the PyTorch data pipeline, and the results charts and tables | ~33% |
| **B. Models & experiments** | **Dama Sriram** | The CNN, the two heads (cross-entropy and CORAL), training and metrics | ~34% |
| **C. Application & deployment** | **Nikhil** | The sketchbook web app, live grading, ONNX export and Cloudflare hosting | ~33% |

## Part A — Data pipeline & results analysis (Prajithaa)

| Area | Responsibility | Files |
|---|---|---|
| Ripeness scale | The 4 ordered grades (0 Unripe, 1 Turning, 2 Ripe, 3 Overripe) and the labelling guide | `src/config.py` |
| Data download | Sparse Git checkout of the Fruits-360 banana/tomato folders; downloading the Hugging Face parquet files | `README.md`, `WORKFLOW.md` |
| Label mapping | Mapping each Fruits-360 folder to a grade; excluding cultivar colours (yellow, maroon tomatoes, red banana) | `src/config.py` |
| Caption-to-grade rules | Regex keyword rules that turn real-world banana captions into grades; extracting images from parquet; dropping 12 ambiguous captions | `src/prepare_data.py` |
| Split builder | Manifest of 4,425 images; train / validation (15% stratified by source and grade) / three test sets; held-out cultivars; every 3rd Fruits-360 frame to remove near-duplicates | `src/prepare_data.py`, `data/processed/` |
| PyTorch data pipeline | `Dataset` class with in-memory image cache; train and eval transforms (crop, flips, rotation, brightness/contrast, no hue jitter); ImageNet normalisation; grade-balanced `WeightedRandomSampler` | `src/dataset.py` |
| Self-collected subset | Photographing bananas and tomatoes at every grade (especially fully green bananas); 70/15/15 split of those photos | `data/self_collected/`, `src/prepare_data.py` |
| Results analysis | Aggregating all runs into mean ± std tables; per-seed pooled metrics; confusion matrices; error-distance, comparison, training-curve, dataset and sample figures; `results.json` for the website | `src/report.py`, `outputs/` |
| Report sections | 1 Introduction, 2 Problem Statement, 3 Dataset | `docs/build/make_report.js` |
| Slides | Title, problem, objectives, data sources, splits (slides 1–5) | `docs/build/make_slides.js` |
| Viva topics | Why ordinal, label mapping, caption rules, class imbalance and the balanced sampler, augmentation choices, near-duplicate frames, why three test sets, how the result charts are computed | `docs/Viva_QA.md` §1–2, §4 |

## Part B — Models & experiments (Dama Sriram)

| Area | Responsibility | Files |
|---|---|---|
| Backbone | ImageNet-pretrained ResNet-18, 112 × 112 input | `src/models.py` |
| Cross-entropy head | 512 → 4 logits, softmax, argmax (the baseline) | `src/models.py` |
| CORAL head | Shared weight + 3 threshold biases, CORAL loss, prediction rule, class probabilities, ripeness score | `src/models.py` |
| Training loop | AdamW, cosine schedule, 10× head learning rate, checkpoint selection by validation MAE, test evaluation and prediction files | `src/train.py` |
| Debugging | Explaining why the first CORAL run stalled (bunched thresholds) and how it was fixed | `src/models.py`, `src/train.py` |
| Metrics | Accuracy, MAE, within-one, severe-error rate, QWK, macro-F1 | `src/metrics.py` |
| Experiments | Running both heads × 3 seeds on identical splits | `run_experiments.sh`, `outputs/runs/` |
| Report sections | 4 Methodology, 6 Results | `docs/build/make_report.js` |
| Slides | Method, CORAL, setup, headline results, per-test-set results, confusion matrices, error distance (slides 6–12) | `docs/build/make_slides.js` |
| Viva topics | How CORAL works, rank consistency, fair comparison, why MAE, seeds, the training bug and its fix | `docs/Viva_QA.md` §3–4 |

## Part C — Application & deployment (Nikhil)

| Area | Responsibility | Files |
|---|---|---|
| Sketchbook interface | Nine plates, page turns, magnifying glass, zoom, keyboard controls, phone layout | `app/static/index.html` |
| Live grading bench | Upload / drop / paste a photo; both models side by side; ripeness meter | `app/static/index.html` |
| Local server | Flask API for predictions, results and saving self-collected photos | `app/app.py`, `src/predict.py` |
| Browser models | Export to ONNX, 8-bit quantisation, check agreement with PyTorch | `src/export_onnx.py` |
| Hosting | Building the static site and deploying it to Cloudflare Pages | `src/build_site.py`, `site/` |
| Report section | 5 Implementation (code structure, demo, hosting) | `docs/build/make_report.js` |
| Slides | Live demo (slide 13) | `docs/build/make_slides.js` |
| Viva topics | How the demo works, quantisation, running models in the browser, how to add data | `docs/Viva_QA.md` §5 |

## Shared by all three

| Item | Notes |
|---|---|
| 7 Discussion and 8 Conclusion | Written together once the final results are in |
| Limitations and future work | Each member adds the points from their own part |
| Presentation | Each member presents their own part; rehearse the hand-overs |
| Viva preparation | Everyone reads all of `docs/Viva_QA.md`, since the viva tests individual understanding of the whole project |

## Remaining work

| Task | Owner | Status |
|---|---|---|
| Take self-collected photos (20–50 per fruit and grade, mixed light) | Prajithaa (everyone helps photograph) | Not started |
| Train seed 123 for both heads | Dama Sriram | Not started |
| Regenerate the results tables and charts with all seeds | Prajithaa | Not started |
| Rebuild and redeploy the website with the final results | Nikhil | Not started |
| Generate the report (`Project_Report.docx`) and slides (`Presentation.pptx`) | Report: Prajithaa · Slides: Nikhil | Not started |
| Fill the results blanks in `docs/Viva_QA.md` | Dama Sriram | Not started |

Live site: https://fruit-ripeness-sketchbook.pages.dev
