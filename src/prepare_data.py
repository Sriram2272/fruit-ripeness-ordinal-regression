"""Builds data/processed/manifest.csv: one row per image with its fruit, ripeness grade,
source and split.

Splits
  train / val       Fruits-360 "Training" frames of the training varieties, the HF banana
                    train split and 70%/15% of any self-collected photos.
  test_seen         Fruits-360 "Test" frames of the same varieties (same cultivars, new frames).
  test_unseen       Every frame of varieties held out completely (harder: new cultivars).
  test_real         Real-world banana photos (HF test split) + 15% of self-collected photos.

Run:  python src/prepare_data.py
"""
import io
import random
import re
from pathlib import Path

import pandas as pd
from PIL import Image

from config import (FRUITS360, FRUITS360_GRADES, FRUITS360_STRIDE, GRADES, HF_BANANAS,
                    PROCESSED, ROOT, SEED, SELF_COLLECTED)

# One variety per grade (where a grade has more than one) never appears in training.
HELD_OUT_VARIETIES = {"Tomato 10", "Tomato 5", "Tomato 8", "Banana 2"}

IMAGE_EXT = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def rel(p: Path) -> str:
    return p.relative_to(ROOT).as_posix()


def fruits360_rows():
    rows = []
    for folder, grade in FRUITS360_GRADES.items():
        fruit = folder.split()[0].lower()
        for part in ("Training", "Test"):
            files = sorted(f for f in (FRUITS360 / part / folder).iterdir() if f.suffix.lower() in IMAGE_EXT)
            files = files[::FRUITS360_STRIDE]
            if folder in HELD_OUT_VARIETIES:
                split = "test_unseen"
            else:
                split = "train" if part == "Training" else "test_seen"
            rows += [dict(path=rel(f), fruit=fruit, grade=grade, source="fruits360",
                          variety=folder, split=split) for f in files]
    return rows


# Caption -> grade rules for the real-world banana set. The first matching rule wins;
# captions that match nothing are ambiguous ("banana missing its tip") and are dropped.
CAPTION_RULES = [
    (r"unripe|partially green|green banana", 1),
    (r"rott|decompos|overripe|mostly black|completely black|color black|black peel|"
     r"peel partially black|large black spot|crushed|rotten", 3),
    (r"\bripe\b|yellow", 2),
]


def caption_grade(text: str):
    t = text.lower()
    for pattern, grade in CAPTION_RULES:
        if re.search(pattern, t):
            return grade
    return None


def hf_banana_rows():
    rows, dropped = [], 0
    for hf_split, split in (("train", "train"), ("test", "test_real")):
        out_dir = HF_BANANAS / "images" / hf_split
        out_dir.mkdir(parents=True, exist_ok=True)
        df = pd.read_parquet(HF_BANANAS / f"{hf_split}.parquet")
        for i, r in df.iterrows():
            grade = caption_grade(r["text"])
            if grade is None:
                dropped += 1
                continue
            path = out_dir / f"{i:04d}.jpg"
            if not path.exists():
                Image.open(io.BytesIO(r["image"]["bytes"])).convert("RGB").save(path, quality=95)
            rows.append(dict(path=rel(path), fruit="banana", grade=grade, source="hf_bananas",
                             variety=r["text"], split=split))
    print(f"hf_bananas: kept {len(rows)}, dropped {dropped} ambiguous captions")
    return rows


def self_collected_rows():
    """data/self_collected/<fruit>/<grade>_<name>/*.jpg, e.g. banana/0_unripe/img1.jpg"""
    rows = []
    rng = random.Random(SEED)
    for fruit_dir in sorted(p for p in SELF_COLLECTED.glob("*") if p.is_dir()):
        for grade_dir in sorted(p for p in fruit_dir.iterdir() if p.is_dir()):
            grade = int(grade_dir.name.split("_")[0])
            files = sorted(f for f in grade_dir.iterdir() if f.suffix.lower() in IMAGE_EXT)
            rng.shuffle(files)
            n_test, n_val = round(0.15 * len(files)), round(0.15 * len(files))
            for k, f in enumerate(files):
                split = "test_real" if k < n_test else "val" if k < n_test + n_val else "train"
                rows.append(dict(path=rel(f), fruit=fruit_dir.name, grade=grade,
                                 source="self_collected", variety=grade_dir.name, split=split))
    print(f"self_collected: {len(rows)} images")
    return rows


def main():
    df = pd.DataFrame(fruits360_rows() + hf_banana_rows() + self_collected_rows())

    # 15% of each (source, grade) group of the training pool becomes validation.
    train_idx = df.index[(df.split == "train") & (df.source != "self_collected")]
    val_idx = (df.loc[train_idx].groupby(["source", "grade"], group_keys=False)
               .sample(frac=0.15, random_state=SEED).index)
    df.loc[val_idx, "split"] = "val"

    PROCESSED.mkdir(parents=True, exist_ok=True)
    df.to_csv(PROCESSED / "manifest.csv", index=False)

    table = pd.crosstab([df.split, df.fruit], df.grade.map(dict(enumerate(GRADES))))
    table = table.reindex(columns=[g for g in GRADES if g in table.columns])
    print(table)
    table.to_csv(PROCESSED / "split_summary.csv")
    print(f"\n{len(df)} images -> {PROCESSED / 'manifest.csv'}")


if __name__ == "__main__":
    main()
