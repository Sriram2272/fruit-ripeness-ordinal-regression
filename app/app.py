"""Sketchbook web demo: grades fruit photos with both models side by side, shows the
experiment results, and saves labelled photos into the self-collected subset.

    python app/app.py        ->  http://127.0.0.1:5000
"""
import json
import sys
import time
from io import BytesIO
from pathlib import Path

from flask import Flask, abort, jsonify, request, send_file, send_from_directory
from PIL import Image, UnidentifiedImageError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from config import FIGURES, GRADES, MODELS, OUTPUTS, ROOT, SELF_COLLECTED  # noqa: E402
from dataset import load_manifest  # noqa: E402
from predict import grade_image, load_model  # noqa: E402

app = Flask(__name__, static_folder="static", static_url_path="/static")
app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024

MANIFEST = load_manifest()
ALLOWED_PATHS = set(MANIFEST.path)
_models = {}


def models():
    if not _models:
        for head in ("ce", "coral"):
            if (MODELS / f"{head}_seed42.pt").exists():
                _models[head] = load_model(head)
    return _models


def read_upload():
    f = request.files.get("image")
    if f is None:
        abort(400, "no image")
    try:
        return Image.open(BytesIO(f.read())).convert("RGB")
    except UnidentifiedImageError:
        abort(400, "not an image")


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/img/<path:path>")
def image(path):
    if path not in ALLOWED_PATHS:
        abort(404)
    return send_file(ROOT / path)


@app.get("/figures/<name>")
def figure(name):
    return send_from_directory(FIGURES, name)


@app.get("/api/results")
def results():
    p = OUTPUTS / "results.json"
    return jsonify(json.loads(p.read_text()) if p.exists() else {})


@app.get("/api/samples")
def samples():
    return jsonify(pick_samples(MANIFEST))


def pick_samples(manifest, src=lambda path: f"/img/{path}"):
    """A few test images per fruit and grade for the specimen tray, interleaved by grade."""
    test = manifest[manifest.split.isin(["test_unseen", "test_real", "test_seen"])]
    shuffled = test.sample(frac=1, random_state=1)
    picked = shuffled.assign(k=shuffled.groupby(["fruit", "grade"]).cumcount())
    picked = picked[picked.k < 3].sort_values(["k", "fruit", "grade"])
    return [dict(path=r.path, src=src(r.path), fruit=r.fruit, grade=int(r.grade), label=GRADES[r.grade], split=r.split)
            for r in picked.itertuples()]


@app.get("/api/dataset")
def dataset():
    return jsonify(dataset_summary(MANIFEST))


def dataset_summary(manifest):
    counts = manifest.groupby(["fruit", "split", "grade"]).size()
    return {"grades": GRADES, "total": int(len(manifest)),
            "counts": [dict(fruit=f, split=s, grade=int(g), n=int(n)) for (f, s, g), n in counts.items()]}


@app.post("/api/predict")
def predict():
    if request.is_json:
        path = request.json.get("path", "")
        if path not in ALLOWED_PATHS:
            abort(404)
        img = Image.open(ROOT / path).convert("RGB")
    else:
        img = read_upload()
    ms = models()
    if not ms:
        return jsonify(error="No trained models yet. Run: bash run_experiments.sh"), 503
    return jsonify({"grades": GRADES, **{head: grade_image(m, img) for head, m in ms.items()}})


@app.post("/api/collect")
def collect():
    """Adds a labelled photo to data/self_collected/<fruit>/<grade>_<name>/ for the next run."""
    fruit = request.form.get("fruit", "")
    grade = request.form.get("grade", "")
    if fruit not in ("banana", "tomato") or not grade.isdigit() or int(grade) >= len(GRADES):
        abort(400, "fruit must be banana/tomato and grade 0-3")
    img = read_upload()
    img.thumbnail((512, 512))
    folder = SELF_COLLECTED / fruit / f"{grade}_{GRADES[int(grade)].lower()}"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{int(time.time() * 1000)}.jpg"
    img.save(path, quality=92)
    n = sum(1 for _ in folder.glob("*.jpg"))
    return jsonify(saved=path.relative_to(ROOT).as_posix(), count_in_class=n)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
