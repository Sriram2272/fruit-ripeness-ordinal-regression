"""Builds the static sketchbook site in site/ for Cloudflare Pages: the same page as the
Flask demo, but the data comes from JSON files and both models run in the browser (ONNX).

    python src/export_onnx.py      # writes site/models/*.onnx
    python src/build_site.py
    npx wrangler pages deploy site --project-name fruit-ripeness-sketchbook
"""
import json
import shutil
import sys

from config import FIGURES, OUTPUTS, ROOT

sys.path.insert(0, str(ROOT / "app"))
from app import dataset_summary, pick_samples  # noqa: E402
from dataset import load_manifest  # noqa: E402

SITE = ROOT / "site"
STATIC = ROOT / "app" / "static"


def main():
    if not (SITE / "models" / "ce.onnx").exists():
        raise SystemExit("Run src/export_onnx.py first.")
    for d in ("data", "specimens", "figures", "static"):
        shutil.rmtree(SITE / d, ignore_errors=True)
        (SITE / d).mkdir(parents=True)

    html = (STATIC / "index.html").read_text(encoding="utf-8")
    html = html.replace("</title>", "</title>\n<script>window.STATIC_SITE = true;</script>", 1)
    (SITE / "index.html").write_text(html, encoding="utf-8")
    shutil.copytree(STATIC / "fonts", SITE / "static" / "fonts")

    manifest = load_manifest()
    samples = pick_samples(manifest, src=lambda path: f"specimens/{path.replace('/', '_').replace(' ', '_')}")
    for s in samples:
        shutil.copy(ROOT / s["path"], SITE / s["src"])
    (SITE / "data" / "samples.json").write_text(json.dumps(samples))
    (SITE / "data" / "dataset.json").write_text(json.dumps(dataset_summary(manifest)))
    shutil.copy(OUTPUTS / "results.json", SITE / "data" / "results.json")
    for png in FIGURES.glob("*.png"):
        shutil.copy(png, SITE / "figures" / png.name)

    (SITE / "_headers").write_text("/models/*\n  Cache-Control: public, max-age=604800\n")
    total = sum(f.stat().st_size for f in SITE.rglob("*") if f.is_file())
    biggest = max((f for f in SITE.rglob("*") if f.is_file()), key=lambda f: f.stat().st_size)
    print(f"site/ built: {total / 1e6:.1f} MB, largest file {biggest.name} {biggest.stat().st_size / 2**20:.1f} MiB")


if __name__ == "__main__":
    main()
