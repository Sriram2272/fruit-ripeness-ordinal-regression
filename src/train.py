"""Trains one model (CE baseline or CORAL ordinal) on the shared splits and evaluates it.

    python src/train.py --head coral --seed 42
    python src/train.py --head ce    --seed 42

Both heads see exactly the same images, augmentations, sampler order, optimiser and
schedule, so any difference in the results comes from the head and its loss.
"""
import argparse
import json
import random
import time

import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader

from config import MODELS, OUTPUTS, SEED
from dataset import RipenessDataset, balanced_sampler, eval_tf, load_manifest, train_tf
from metrics import compute_metrics
from models import RipenessNet

TEST_SPLITS = ["test_seen", "test_unseen", "test_real"]


def set_seed(seed):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


@torch.no_grad()
def run_eval(model, loader):
    model.eval()
    ys, preds, probs, scores = [], [], [], []
    for x, y in loader:
        p, pr, s = model.predict(model(x))
        ys.append(y); preds.append(p); probs.append(pr); scores.append(s)
    return (torch.cat(ys).numpy(), torch.cat(preds).numpy(),
            torch.cat(probs).numpy(), torch.cat(scores).numpy())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--head", choices=["ce", "coral"], required=True)
    ap.add_argument("--seed", type=int, default=SEED)
    ap.add_argument("--epochs", type=int, default=8)
    ap.add_argument("--batch-size", type=int, default=32)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--head-lr-mult", type=float, default=10.0)
    args = ap.parse_args()

    set_seed(args.seed)
    torch.set_num_threads(max(1, torch.get_num_threads()))
    df = load_manifest()

    train_df = df[df.split == "train"]
    train_ds = RipenessDataset(train_df, train_tf)
    train_loader = DataLoader(train_ds, batch_size=args.batch_size,
                              sampler=balanced_sampler(train_ds.df, args.seed))
    eval_loaders = {s: DataLoader(RipenessDataset(df[df.split == s], eval_tf), batch_size=64)
                    for s in ["val"] + TEST_SPLITS}

    model = RipenessNet(args.head)
    # The new head starts from scratch, so it gets a 10x learning rate (same rule for both heads).
    # Without it, Adam moves each CORAL threshold bias by only ~lr per step and the three
    # thresholds stay bunched together, so the middle grades are never predicted.
    opt = torch.optim.AdamW([
        {"params": model.backbone.parameters(), "lr": args.lr},
        {"params": model.head.parameters(), "lr": args.lr * args.head_lr_mult},
    ], weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=args.epochs * len(train_loader))

    name = f"{args.head}_seed{args.seed}"
    MODELS.mkdir(parents=True, exist_ok=True)
    history, best_mae = [], float("inf")
    for epoch in range(1, args.epochs + 1):
        model.train()
        t0, total, n = time.time(), 0.0, 0
        for x, y in train_loader:
            loss = model.loss(model(x), y)
            opt.zero_grad()
            loss.backward()
            opt.step()
            sched.step()
            total += loss.item() * len(y)
            n += len(y)
        y, pred, _, _ = run_eval(model, eval_loaders["val"])
        val = compute_metrics(y, pred)
        history.append(dict(epoch=epoch, train_loss=total / n, val_accuracy=val["accuracy"],
                            val_mae=val["mae"], seconds=time.time() - t0))
        print(f"[{name}] epoch {epoch}/{args.epochs} loss {total / n:.4f} "
              f"val acc {val['accuracy']:.3f} val MAE {val['mae']:.3f} ({time.time() - t0:.0f}s)", flush=True)
        # Model selection on validation MAE for both heads, so neither gets an advantage.
        if val["mae"] < best_mae or (val["mae"] == best_mae and epoch == 1):
            best_mae = val["mae"]
            torch.save({"head": args.head, "state_dict": model.state_dict(), "epoch": epoch}, MODELS / f"{name}.pt")

    model.load_state_dict(torch.load(MODELS / f"{name}.pt")["state_dict"])
    results = {"head": args.head, "seed": args.seed, "history": history, "test": {}}
    rows = []
    for split in TEST_SPLITS:
        loader = eval_loaders[split]
        y, pred, probs, score = run_eval(model, loader)
        results["test"][split] = compute_metrics(y, pred)
        part = loader.dataset.df[["path", "fruit", "grade", "source", "variety"]].copy()
        part["split"], part["pred"], part["score"] = split, pred, score
        for k in range(probs.shape[1]):
            part[f"p{k}"] = probs[:, k]
        rows.append(part)
        m = results["test"][split]
        print(f"[{name}] {split:12s} acc {m['accuracy']:.3f}  MAE {m['mae']:.3f}  "
              f"severe {m['severe_error_rate']:.3f}  QWK {m['qwk']:.3f}")

    out = OUTPUTS / "runs"
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{name}.json").write_text(json.dumps(results, indent=2))
    pd.concat(rows).to_csv(out / f"{name}_predictions.csv", index=False)


if __name__ == "__main__":
    main()
