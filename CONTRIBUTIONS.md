# Team Contributions

**Project:** Fruit Ripeness Grading via Ordinal Regression
**Team:** Prajithaa · Dama Sriram · Nikhil

The project is divided into three parts of roughly equal size. Each member owns one part: they are responsible
for it, present it, and answer viva questions on it. The discussion, conclusion and rehearsal are shared.

## Overview

| Part | Owner | What the part covers | Share |
|---|---|---|---|
| **A. Data** | **Prajithaa** | Collecting, labelling and splitting the images | ~33% |
| **B. Models & experiments** | **Dama Sriram** | The CNN, the two heads (cross-entropy and CORAL), training and evaluation | ~34% |
| **C. Application & deployment** | **Nikhil** | The sketchbook web app, live grading, ONNX export and Cloudflare hosting | ~33% |

## Part A — Data (Prajithaa)

| Area | Responsibility | Files |
|---|---|---|
| Ripeness scale | The 4 ordered grades (0 Unripe, 1 Turning, 2 Ripe, 3 Overripe) and the labelling guide | `src/config.py` |
| Fruits-360 | Downloading the banana and tomato folders; mapping each folder to a grade; excluding cultivar colours (yellow, maroon tomatoes, red banana) | `src/config.py`, `README.md` |
| Real-world bananas | Turning the Hugging Face captions into grades with keyword rules; dropping 12 ambiguous captions | `src/prepare_data.py` |
| Self-collected subset | Photographing bananas and tomatoes at every grade (especially fully green bananas) and filing them in the right folders | `data/self_collected/` |
| Splits | Train / validation / three test sets (seen varieties, unseen varieties, real-world); keeping every 3rd Fruits-360 frame | `src/prepare_data.py`, `data/processed/` |
| Dataset figures | Example-image grid and images-per-split chart | `outputs/figures/samples.png`, `dataset.png` |
| Report sections | 1 Introduction, 2 Problem Statement, 3 Dataset | `docs/build/make_report.js` |
| Slides | Title, problem, objectives, data sources, splits (slides 1–5) | `docs/build/make_slides.js` |
| Viva topics | Why ordinal, label mapping, class imbalance, near-duplicate frames, why three test sets, dataset limitations | `docs/Viva_QA.md` §1–2 |

## Part B — Models & experiments (Dama Sriram)

| Area | Responsibility | Files |
|---|---|---|
| Backbone | ImageNet-pretrained ResNet-18, 112 × 112 input | `src/models.py` |
| Cross-entropy head | 512 → 4 logits, softmax, argmax (the baseline) | `src/models.py` |
| CORAL head | Shared weight + 3 threshold biases, CORAL loss, prediction rule, class probabilities, ripeness score | `src/models.py` |
| Training setup | Augmentations (no hue jitter), grade-balanced sampler, AdamW, cosine schedule, 10× head learning rate | `src/dataset.py`, `src/train.py` |
| Debugging | Explaining why the first CORAL run stalled (bunched thresholds) and how it was fixed | `src/models.py`, `src/train.py` |
| Metrics | Accuracy, MAE, within-one, severe-error rate, QWK, macro-F1 | `src/metrics.py` |
| Experiments | Both heads × 3 seeds on identical splits; results tables and charts | `run_experiments.sh`, `src/report.py`, `outputs/` |
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
| Train seed 123 for both heads and regenerate results | Dama Sriram | Not started |
| Rebuild and redeploy the website with the final results | Nikhil | Not started |
| Generate the report (`Project_Report.docx`) and slides (`Presentation.pptx`) | Report: Prajithaa · Slides: Nikhil | Not started |
| Fill the results blanks in `docs/Viva_QA.md` | Dama Sriram | Not started |

Live site: https://fruit-ripeness-sketchbook.pages.dev
