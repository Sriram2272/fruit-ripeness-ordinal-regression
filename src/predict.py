"""Grades a single image with both trained models.

    python src/predict.py path/to/banana.jpg
"""
import argparse
import time

import torch
from PIL import Image

from config import GRADES, MODELS
from dataset import eval_tf
from models import RipenessNet


def load_model(head: str, seed: int = 42) -> RipenessNet:
    ckpt = torch.load(MODELS / f"{head}_seed{seed}.pt", map_location="cpu")
    model = RipenessNet(head, pretrained=False)
    model.load_state_dict(ckpt["state_dict"])
    return model.eval()


@torch.no_grad()
def grade_image(model: RipenessNet, img: Image.Image) -> dict:
    t0 = time.perf_counter()
    x = eval_tf(img.convert("RGB")).unsqueeze(0)
    pred, probs, score = model.predict(model(x))
    return {
        "grade": int(pred[0]),
        "label": GRADES[int(pred[0])],
        "probs": [round(float(p), 4) for p in probs[0]],
        "score": round(float(score[0]), 3),          # expected grade on the 0-3 scale
        "ms": round((time.perf_counter() - t0) * 1000, 1),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    img = Image.open(args.image)
    for head in ("ce", "coral"):
        r = grade_image(load_model(head, args.seed), img)
        probs = "  ".join(f"{g}: {p:.2f}" for g, p in zip(GRADES, r["probs"]))
        print(f"{head:5s} -> {r['label']:9s} (score {r['score']:.2f})   {probs}")


if __name__ == "__main__":
    main()
