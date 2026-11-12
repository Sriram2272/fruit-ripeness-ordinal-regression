# Fruit Ripeness Grading via Ordinal Regression

Course project: treat fruit ripeness (Unripe → Turning → Ripe → Overripe) as an **ordinal**
problem. The same ResNet-18 is trained twice on identical splits — once with a standard
**cross-entropy** head (baseline) and once with a **CORAL ordinal-regression** head — and
the two are compared on accuracy and mean absolute error (MAE).

Everything is presented in a sketchbook-style web app (nine "plates") that also grades
photos live with both models.

## Project layout

```
src/
  config.py         paths, the 4 grades, Fruits-360 folder -> grade mapping
  prepare_data.py   builds data/processed/manifest.csv and the five splits
  dataset.py        PyTorch dataset, augmentations (no hue jitter), balanced sampler
  models.py         ResNet-18 + CE head / CORAL head, CORAL loss, prediction rule
  metrics.py        accuracy, MAE, within-one, severe-error rate, QWK, macro-F1
  train.py          trains one head with one seed, evaluates on all test sets
  report.py         aggregates runs -> outputs/results.json, tables, figures
  predict.py        grade one image from the command line
  export_onnx.py    exports both models to 8-bit ONNX for the browser
  build_site.py     builds the static site in site/ for Cloudflare Pages
app/
  app.py            Flask server for the local demo
  static/index.html the sketchbook UI (shared by the local app and the hosted site)
data/
  raw/fruits360     Fruits-360 banana + tomato folders (sparse git clone)
  raw/hf_bananas    real-world banana photos (Hugging Face josedonoso/bananas-dataset-v1)
  self_collected/   your own photos: <fruit>/<grade>_<name>/*.jpg
outputs/            checkpoints, per-run JSON, predictions, figures, summary tables
docs/
  Viva_QA.md        viva preparation
  build/            make_report.js / make_slides.js write docs/Project_Report.docx and
                    docs/Presentation.pptx from outputs/results.json (not generated yet)
site/               the static site deployed to Cloudflare Pages
```

See also [WORKFLOW.md](WORKFLOW.md) (step-by-step guide) and [CONTRIBUTIONS.md](CONTRIBUTIONS.md) (who owns which part).

Model checkpoints (`outputs/models/`) and raw datasets (`data/raw/`) are not in the repository; download the
data with the commands below and train with `run_experiments.sh`.

## Setup (Windows, Git Bash)

```bash
python -m venv .venv
.venv/Scripts/python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
.venv/Scripts/python -m pip install -r requirements.txt
```

Data (already downloaded in this folder; to re-download):

```bash
git clone --depth 1 --filter=blob:none --sparse https://github.com/fruits-360/fruits-360-100x100.git data/raw/fruits360
cd data/raw/fruits360 && git sparse-checkout set --no-cone '/Training/Banana*' '/Training/Tomato*' '/Test/Banana*' '/Test/Tomato*'
# real-world bananas
curl -L -o data/raw/hf_bananas/train.parquet https://huggingface.co/datasets/josedonoso/bananas-dataset-v1/resolve/main/data/train-00000-of-00001.parquet
curl -L -o data/raw/hf_bananas/test.parquet  https://huggingface.co/datasets/josedonoso/bananas-dataset-v1/resolve/main/data/test-00000-of-00001.parquet
```

## Run

```bash
bash run_experiments.sh                 # prepare data, train CE + CORAL x 3 seeds, report (~75 min on CPU)
.venv/Scripts/python app/app.py         # sketchbook demo at http://127.0.0.1:5000
.venv/Scripts/python src/predict.py some_banana.jpg
```

Sketchbook controls: ← / → turn pages, `+` / `−` / `0` zoom, `M` magnifying glass (drag it over a fruit),
click a plate in the index to jump to it. Plate V is the live grading bench; Plate IX saves labelled
photos into `data/self_collected/` (on the hosted site it downloads them with a labelled name instead).

Live site: https://fruit-ripeness-sketchbook.pages.dev

## Host on Cloudflare Pages

The hosted site is static: both models run in the visitor's browser with ONNX Runtime Web.

```bash
.venv/Scripts/python src/export_onnx.py     # 8-bit ONNX models (~11 MB each) + agreement check
.venv/Scripts/python src/build_site.py      # site/
cd docs/build && npx wrangler pages deploy ../../site --project-name fruit-ripeness-sketchbook --branch main
```

Run the deploy from `docs/build`. It has its own `package.json`; on this machine, running wrangler from a
folder without one makes it use the home folder as the project root, and the deploy fails with "Not logged in".

## Adding the self-collected subset

1. Photograph bananas/tomatoes at each stage (aim for 50+ per fruit and grade, mixed light and backgrounds).
   Fully green bananas are the most important: neither public source has them.
2. Save them from Plate IX of the app, or copy them into `data/self_collected/banana/0_unripe/` etc.
3. Re-run `bash run_experiments.sh`. Self-collected photos are split 70/15/15 into train/val/real-world test.

## Method in one paragraph

ImageNet-pretrained ResNet-18, 112×112 input, AdamW (backbone lr 3e-4, new head 10x = 3e-3, weight decay 1e-4, cosine schedule),
8 epochs, batch 32, grade-balanced sampling, augmentations = random resized crop, flips, ±20° rotation,
brightness/contrast jitter (no hue jitter: colour is the ripeness cue). The **CE head** is a 512→4 linear
layer with softmax cross-entropy. The **CORAL head** is a 512→1 linear layer shared by three binary
tasks "grade > k" with separate biases (initialised at logit(0.75), logit(0.5), logit(0.25), i.e. the balanced class prior); the loss is the sum of the three binary cross-entropies and the
prediction is the number of tasks with probability > 0.5. Checkpoints are selected by validation MAE for
both heads. Each head is trained with seeds 42, 7 and 123; results are reported as mean ± std.
