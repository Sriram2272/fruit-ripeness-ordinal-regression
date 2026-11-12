# How to Use This Project — Step by Step

A simple guide. Read the tables from top to bottom and do one row at a time.

---

## 1. What does this project do?

| Question | Simple answer |
|---|---|
| What goes in? | A photo of a **banana** or a **tomato** |
| What comes out? | How ripe it is: one of 4 grades |
| How? | A computer program that learned from about 4,400 fruit photos |
| What is special? | We built **two** programs and checked which one makes smaller mistakes |

### The 4 grades

| Number | Grade | What the fruit looks like |
|---|---|---|
| 0 | 🟢 Unripe | Fully green, hard |
| 1 | 🟠 Turning | Starting to change colour, some green left |
| 2 | 🔴 Ripe | Full colour, ready to eat |
| 3 | 🟤 Overripe | Dark patches, wrinkles, spots or rot |

The grades are **in order**: 0 → 1 → 2 → 3. Calling a green banana "Overripe" is a **bigger** mistake than calling it "Turning".

### The two programs

| Program | How it thinks | Nickname |
|---|---|---|
| Cross-entropy (CE) | "Which of 4 boxes is it?" — every wrong box is equally wrong | The baseline |
| CORAL | "Is it past grade 0? Past 1? Past 2?" — knows the grades are in order | The ordinal model |

---

## 2. The easiest way: just open the website

Nothing to install.

| Step | What you do | What happens |
|---|---|---|
| 1 | Open **https://fruit-ripeness-sketchbook.pages.dev** | A sketchbook opens |
| 2 | Press **→** (arrow key) or click **→** at the bottom | The page turns |
| 3 | Go to **Plate V · The grading bench** | You see an upload box and small fruit pictures |
| 4 | Click a small fruit picture, or drop your own photo in the box | Both programs grade it (the first time takes a few seconds) |
| 5 | Read the two cards | Each card shows the grade and how sure the program is |

### Buttons and keys

| Button / key | What it does |
|---|---|
| **←** / **→** | Previous / next page |
| **Home** / **End** | First / last page |
| Click a line in the contents (page I) | Jump to that page |
| **◎ Lens** or the **M** key | Shows a magnifying glass. Drag it over a fruit |
| **+** / **−** | Zoom in / out |
| **0** (zero) | Normal size |
| **Esc** | Hide the magnifying glass |

### The nine pages

| Page | Name | What is on it |
|---|---|---|
| I | Frontispiece | Title and contents |
| II | Why ordinal? | Why some mistakes are worse than others |
| III | The specimens | Where the photos came from |
| IV | Method | How the two programs are built |
| V | The grading bench | **Try it yourself** |
| VI | Results | Scores of both programs |
| VII | Where errors land | Which grades get mixed up |
| VIII | Training notes | How learning went, epoch by epoch |
| IX | Field notes | Conclusion, limits, adding your own photos |

---

## 3. Running it on your own computer

Use **Git Bash** on Windows. Type each command, press **Enter**, and wait until it finishes before the next one.

### 3a. One-time setup

| Step | Type this | What it does | Time |
|---|---|---|---|
| 1 | `git clone https://github.com/Sriram2272/fruit-ripeness-ordinal-regression.git` | Downloads the project | 1 min |
| 2 | `cd fruit-ripeness-ordinal-regression` | Goes into the project folder | – |
| 3 | `python -m venv .venv` | Makes a private box for Python tools | 1 min |
| 4 | `.venv/Scripts/python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu` | Installs the AI library | 5–10 min |
| 5 | `.venv/Scripts/python -m pip install -r requirements.txt` | Installs the other tools | 2 min |

### 3b. Download the photos

The photos are not stored on GitHub because they are big. Run these once:

| Step | Type this | What it does |
|---|---|---|
| 1 | `git clone --depth 1 --filter=blob:none --sparse https://github.com/fruits-360/fruits-360-100x100.git data/raw/fruits360` | Gets the Fruits-360 index |
| 2 | `cd data/raw/fruits360 && git sparse-checkout set --no-cone '/Training/Banana*' '/Training/Tomato*' '/Test/Banana*' '/Test/Tomato*' && cd ../../..` | Downloads only bananas and tomatoes (~230 MB) |
| 3 | `mkdir -p data/raw/hf_bananas` | Makes a folder for real-world photos |
| 4 | `curl -L -o data/raw/hf_bananas/train.parquet https://huggingface.co/datasets/josedonoso/bananas-dataset-v1/resolve/main/data/train-00000-of-00001.parquet` | Downloads real-world banana photos (part 1) |
| 5 | `curl -L -o data/raw/hf_bananas/test.parquet https://huggingface.co/datasets/josedonoso/bananas-dataset-v1/resolve/main/data/test-00000-of-00001.parquet` | Downloads real-world banana photos (part 2) |

### 3c. Teach the programs (training)

The trained models are not on GitHub either (too big), so train them once:

| Step | Type this | What it does | Time |
|---|---|---|---|
| 1 | `bash run_experiments.sh` | Sorts the photos, trains both programs 3 times each, makes the charts | ~1.5–2 hours |

Or one step at a time:

| Step | Type this | What it does |
|---|---|---|
| 1 | `cd src` | Go to the code folder |
| 2 | `../.venv/Scripts/python prepare_data.py` | Sorts photos into train / validation / test |
| 3 | `../.venv/Scripts/python train.py --head ce --seed 42 --epochs 8` | Trains the baseline (~15 min) |
| 4 | `../.venv/Scripts/python train.py --head coral --seed 42 --epochs 8` | Trains CORAL (~15 min) |
| 5 | `../.venv/Scripts/python report.py` | Makes the results tables and charts |
| 6 | `cd ..` | Back to the project folder |

### 3d. Use it

| What you want | Type this | Then |
|---|---|---|
| Open the sketchbook on your computer | `.venv/Scripts/python app/app.py` | Open **http://127.0.0.1:5000** in your browser. Stop it with **Ctrl + C** |
| Grade one photo in the terminal | `.venv/Scripts/python src/predict.py my_banana.jpg` | Both programs print their grade |

---

## 4. Adding your own photos (self-collected subset)

| Step | What you do |
|---|---|
| 1 | Take a clear photo of **one** banana or tomato |
| 2 | Decide its grade with the table in section 1 |
| 3 | Open the local app, go to **Plate IX**, pick the fruit and grade, choose the photo, press **Save to dataset** |
| 4 | Or copy the photo into the right folder yourself (table below) |
| 5 | When you have many photos, run `bash run_experiments.sh` again |

| Fruit | Grade | Folder |
|---|---|---|
| Banana | 0 Unripe | `data/self_collected/banana/0_unripe/` |
| Banana | 1 Turning | `data/self_collected/banana/1_turning/` |
| Banana | 2 Ripe | `data/self_collected/banana/2_ripe/` |
| Banana | 3 Overripe | `data/self_collected/banana/3_overripe/` |
| Tomato | 0 Unripe | `data/self_collected/tomato/0_unripe/` |
| Tomato | 1 Turning | `data/self_collected/tomato/1_turning/` |
| Tomato | 2 Ripe | `data/self_collected/tomato/2_ripe/` |
| Tomato | 3 Overripe | `data/self_collected/tomato/3_overripe/` |

Aim for **20–50 photos per row**. Green bananas matter most: no public dataset has them.

---

## 5. Putting the website online again (after changes)

| Step | Type this | What it does |
|---|---|---|
| 1 | `.venv/Scripts/python src/export_onnx.py` | Makes small copies of the models for the browser |
| 2 | `.venv/Scripts/python src/build_site.py` | Builds the website in the `site/` folder |
| 3 | `cd docs/build && npm install` | Installs the deploy tools (first time only) |
| 4 | `npx wrangler pages deploy ../../site --project-name fruit-ripeness-sketchbook --branch main` | Uploads the website to Cloudflare |
| 5 | `cd ../..` | Back to the project folder |

Always run step 4 from `docs/build`; running it from another folder can fail with "Not logged in".

---

## 6. Where everything lives

| Folder / file | What is inside |
|---|---|
| `src/` | The Python code (data, models, training, results) |
| `app/` | The sketchbook website and the local server |
| `data/processed/` | The list of every photo with its grade and split |
| `data/self_collected/` | Your own photos |
| `outputs/figures/` | Charts used in the report and slides |
| `outputs/runs/` | Scores from every training run |
| `site/` | The finished website that goes online |
| `docs/Viva_QA.md` | Questions and answers for the viva |
| `docs/build/` | Scripts that make the report and slides |
| `CONTRIBUTIONS.md` | Who owns which part |
| `README.md` | Short technical summary |

---

## 7. If something goes wrong

| Problem | What to do |
|---|---|
| `python: command not found` | Install Python 3.11 from python.org, tick "Add to PATH", reopen Git Bash |
| `No module named torch` | Redo step 4 of section 3a |
| `No such file ... manifest.csv` | Run `prepare_data.py` first (section 3c, step 2) |
| Local app says "No trained models yet" | Train first (section 3c) |
| Training is very slow | Normal on a laptop: close other programs and let it run |
| Website shows old results | Press **Ctrl + Shift + R** to reload |
| Deploy says "Not logged in" | Run it from `docs/build` (section 5); if it still fails, run `npx wrangler login` |

---

## 8. Remember for the viva

| Word | Meaning in one line |
|---|---|
| Ordinal | The answers have an order (0 < 1 < 2 < 3) |
| CNN | A program that learns patterns in pictures |
| ResNet-18 | The CNN we used, already trained on millions of everyday photos |
| Cross-entropy | The normal way to train a classifier; every mistake counts the same |
| CORAL | An ordinal method: three yes/no questions "is it past grade k?" |
| Accuracy | How often the grade is exactly right |
| MAE | On average, how many grades away the guess is |
| Seed | A starting number for randomness; we use 3 to check the result is not luck |
| ONNX | A model format that lets the website run the models in your browser |
