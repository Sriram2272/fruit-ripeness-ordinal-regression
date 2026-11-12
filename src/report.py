"""Aggregates every run in outputs/runs into tables and figures for the report and slides.

    python src/report.py
"""
import json
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from PIL import Image

from config import FIGURES, GRADES, OUTPUTS, ROOT
from dataset import load_manifest
from metrics import compute_metrics, confusion

RUNS = OUTPUTS / "runs"
HEADS = {"ce": "Cross-entropy (baseline)", "coral": "CORAL (ordinal)"}
COLORS = {"ce": "#1f6fb2", "coral": "#b4532a"}      # validated pair: CVD ΔE 16.9, normal ΔE 23.5
SPLITS = {"test_seen": "Seen varieties", "test_unseen": "Unseen varieties", "test_real": "Real-world bananas"}
METRICS = {"accuracy": "Accuracy", "mae": "MAE", "within_one": "Within ±1", "severe_error_rate": "Severe errors (≥2)",
           "qwk": "QWK", "macro_f1": "Macro-F1"}
INK, MUTED, PAPER, GRID = "#2b2721", "#6b6358", "#fbf8f1", "#e4dccb"

plt.rcParams.update({
    "font.family": "serif", "font.size": 10, "axes.edgecolor": MUTED, "axes.labelcolor": INK,
    "xtick.color": MUTED, "ytick.color": MUTED, "text.color": INK, "axes.titleweight": "normal",
    "axes.titlesize": 12, "figure.facecolor": PAPER, "axes.facecolor": PAPER, "savefig.facecolor": PAPER,
    "axes.spines.top": False, "axes.spines.right": False, "axes.grid": True, "grid.color": GRID,
    "grid.linewidth": 0.6, "axes.axisbelow": True,
})


def load_runs():
    """Only seeds finished for both heads count, so the two means always cover the same seeds."""
    runs = [json.loads(p.read_text()) for p in sorted(RUNS.glob("*.json"))]
    done = {h: {r["seed"] for r in runs if r["head"] == h} for h in HEADS}
    paired = done["ce"] & done["coral"]
    runs = [r for r in runs if r["seed"] in paired]
    rows = [dict(head=r["head"], seed=r["seed"], split=s, **m) for r in runs for s, m in r["test"].items()]
    return runs, pd.DataFrame(rows)


def summary_table(df):
    g = df.groupby(["split", "head"])[list(METRICS)]
    mean, std = g.mean(), g.std().fillna(0)
    table = mean.round(3).astype(str) + " ± " + std.round(3).astype(str)
    table = table.rename(columns=METRICS).reset_index()
    table["split"] = table["split"].map(SPLITS)
    table["head"] = table["head"].map(HEADS)
    return mean, std, table


def fig_comparison(mean, std, seeds):
    fig, axes = plt.subplots(1, 3, figsize=(12, 3.8))
    x = np.arange(len(SPLITS))
    for ax, metric, better in zip(axes, ["accuracy", "mae", "qwk"], ["higher", "lower", "higher"]):
        for i, head in enumerate(HEADS):
            m = [mean.loc[(s, head), metric] for s in SPLITS]
            e = [std.loc[(s, head), metric] for s in SPLITS]
            bars = ax.bar(x + (i - 0.5) * 0.36, m, 0.34, yerr=e, color=COLORS[head], label=HEADS[head],
                          edgecolor=PAPER, linewidth=2, error_kw=dict(ecolor=MUTED, lw=1, capsize=3))
            for b, v in zip(bars, m):
                ax.annotate(f"{v:.2f}", (b.get_x() + b.get_width() / 2, b.get_height()), xytext=(0, 3),
                            textcoords="offset points", ha="center", fontsize=8, color=INK)
        ax.set_xticks(x, [v.replace(" ", "\n", 1) for v in SPLITS.values()], fontsize=9)
        ax.set_title(f"{METRICS[metric]} ({better} is better)")
        ax.grid(axis="x", visible=False)
    axes[0].set_ylim(0, 1.08)
    axes[2].set_ylim(0, 1.08)
    fig.legend(*axes[0].get_legend_handles_labels(), frameon=False, loc="upper right", ncol=2, fontsize=9)
    fig.suptitle(f"Test results, mean ± std over {seeds} seed{'s' if seeds > 1 else ''}", fontsize=13, x=0.02, ha="left")
    fig.tight_layout(rect=(0, 0, 1, 0.94))
    fig.savefig(FIGURES / "comparison.png", dpi=180)
    plt.close(fig)


def seeds_label(n):
    return f"{n} seed{'s' if n > 1 else ''}"


def fig_confusion(preds, n_seeds):
    fig, axes = plt.subplots(1, 2, figsize=(9.5, 4.2))
    for ax, head in zip(axes, HEADS):
        p = preds[head]
        cm = confusion(p.grade, p.pred)
        norm = cm / cm.sum(1, keepdims=True).clip(min=1)
        ax.imshow(norm, cmap="Oranges" if head == "coral" else "Blues", vmin=0, vmax=1)
        for i in range(len(GRADES)):
            for j in range(len(GRADES)):
                ax.text(j, i, cm[i, j], ha="center", va="center", fontsize=9,
                        color="white" if norm[i, j] > 0.55 else INK)
        ax.set_xticks(range(len(GRADES)), GRADES)
        ax.set_yticks(range(len(GRADES)), GRADES)
        ax.set_xlabel("Predicted grade")
        ax.set_ylabel("True grade")
        ax.set_title(HEADS[head])
        ax.grid(False)
    fig.suptitle(f"Confusion matrices, all test images summed over {seeds_label(n_seeds)}", fontsize=13)
    fig.tight_layout()
    fig.savefig(FIGURES / "confusion.png", dpi=180)
    plt.close(fig)


def fig_error_distance(preds, n_seeds):
    fig, ax = plt.subplots(figsize=(6, 3.6))
    x = np.arange(len(GRADES))
    for i, head in enumerate(HEADS):
        err = (preds[head].grade - preds[head].pred).abs()
        share = np.array([(err == d).mean() for d in x])
        ax.bar(x + (i - 0.5) * 0.36, share, 0.34, color=COLORS[head], label=HEADS[head], edgecolor=PAPER, linewidth=2)
        for d, v in zip(x, share):
            ax.annotate(f"{v:.1%}", (d + (i - 0.5) * 0.36, v), xytext=(0, 3), textcoords="offset points",
                        ha="center", fontsize=8)
    ax.set_xticks(x, ["exact", "off by 1", "off by 2", "off by 3"])
    ax.set_ylabel("Share of test images")
    ax.set_title(f"How far off are the predictions? ({seeds_label(n_seeds)})")
    ax.legend(frameon=False)
    ax.grid(axis="x", visible=False)
    fig.tight_layout()
    fig.savefig(FIGURES / "error_distance.png", dpi=180)
    plt.close(fig)


def fig_curves(runs):
    fig, axes = plt.subplots(1, 2, figsize=(10, 3.6))
    for r in runs:
        h = pd.DataFrame(r["history"])
        kw = dict(color=COLORS[r["head"]], lw=2 if r["seed"] == 42 else 1, alpha=1 if r["seed"] == 42 else 0.35)
        axes[0].plot(h.epoch, h.val_mae, label=HEADS[r["head"]] if r["seed"] == 42 else None, **kw)
        axes[1].plot(h.epoch, h.val_accuracy, **kw)
    axes[0].set_title("Validation MAE (lower is better)")
    axes[1].set_title("Validation accuracy")
    for ax in axes:
        ax.set_xlabel("Epoch")
    axes[0].legend(frameon=False)
    fig.suptitle("Training curves (bold = seed 42, faint = other seeds)", fontsize=12)
    fig.tight_layout()
    fig.savefig(FIGURES / "training_curves.png", dpi=180)
    plt.close(fig)


def fig_dataset():
    df = load_manifest()
    names = {"train": "Train", "val": "Val", "test_seen": "Test\nseen", "test_unseen": "Test\nunseen", "test_real": "Test\nreal-world"}
    fig, axes = plt.subplots(1, 2, figsize=(11, 3.8), sharey=True)
    shades = ["#d9c7a7", "#b9996b", "#8b6a3e", "#4e3a22"]          # one-hue light->dark ramp: grade is ordinal
    for ax, fruit in zip(axes, ["tomato", "banana"]):
        present = set(df[df.fruit == fruit].split)
        order = [s for s in names if s in present]
        sub = pd.crosstab(df[df.fruit == fruit].split, df[df.fruit == fruit].grade).reindex(order).fillna(0)
        sub.index = [names[s] for s in order]
        order = list(sub.index)
        bottom = np.zeros(len(order))
        for g in range(len(GRADES)):
            v = sub[g].to_numpy() if g in sub else np.zeros(len(order))
            ax.bar(order, v, bottom=bottom, color=shades[g], label=GRADES[g], edgecolor=PAPER, linewidth=1.5)
            bottom += v
        for i, t in enumerate(bottom):
            ax.annotate(int(t), (i, t), xytext=(0, 3), textcoords="offset points", ha="center", fontsize=8)
        ax.set_title(fruit.capitalize())
        ax.grid(axis="x", visible=False)
    axes[0].set_ylabel("Images")
    axes[1].legend(frameon=False, title="Grade")
    fig.suptitle("Dataset: images per split and ripeness grade", fontsize=13)
    fig.tight_layout()
    fig.savefig(FIGURES / "dataset.png", dpi=180)
    plt.close(fig)


def fig_samples():
    """Real example photos: rows = fruit, columns = grade."""
    df = load_manifest()
    fig, axes = plt.subplots(2, 8, figsize=(13, 3.8))
    for r, fruit in enumerate(["tomato", "banana"]):
        for g in range(len(GRADES)):
            pool = df[(df.fruit == fruit) & (df.grade == g)]
            # one studio and one real-world photo where both exist, else two different images
            picks = pool.sample(frac=1, random_state=3).drop_duplicates("source").head(2)
            if len(picks) < 2:
                picks = pool.sample(frac=1, random_state=3).drop_duplicates("variety").head(2)
            if len(picks) < 2:
                picks = pool.sample(min(2, len(pool)), random_state=3)
            for c in range(2):
                ax = axes[r, g * 2 + c]
                ax.axis("off")
                if c < len(picks):
                    ax.imshow(Image.open(ROOT / picks.path.iloc[c]).convert("RGB"))
                elif c == 0:
                    ax.text(0.5, 0.5, "no public\nimages:\nself-collect", ha="center", va="center",
                            fontsize=9, color=MUTED, style="italic", transform=ax.transAxes)
                if r == 0 and c == 0:
                    ax.set_title(GRADES[g], fontsize=12, loc="left")
        axes[r, 0].text(-0.15, 0.5, fruit.capitalize(), rotation=90, ha="center", va="center",
                        transform=axes[r, 0].transAxes, fontsize=12)
    fig.tight_layout()
    fig.savefig(FIGURES / "samples.png", dpi=170)
    plt.close(fig)


def fig_disagreements(preds):
    """Seed 42 images from the harder test sets where the two heads disagree, worst baseline errors first."""
    a, b = preds["ce"], preds["coral"]
    a, b = a[a.seed == 42].reset_index(drop=True), b[b.seed == 42].reset_index(drop=True)
    d = a.assign(coral=b.pred, ce_err=(a.pred - a.grade).abs(), coral_err=(b.pred - a.grade).abs())
    d = d[(d.pred != d.coral) & (d.split != "test_seen")].sort_values(["ce_err", "coral_err"], ascending=[False, True])
    # neighbouring Fruits-360 frames (and some repeated phone photos) are near-identical: one per variety
    d = d.groupby("variety", sort=False).head(1).head(8)
    if d.empty:
        return
    fig, axes = plt.subplots(2, 4, figsize=(8.4, 5.6))
    for ax in axes.flat:
        ax.axis("off")
    for ax, (_, r) in zip(axes.flat, d.iterrows()):
        ax.imshow(Image.open(ROOT / r.path).convert("RGB"))
        ax.set_title(f"true: {GRADES[r.grade]}\nCE: {GRADES[r.pred]}\nCORAL: {GRADES[r.coral]}", fontsize=10)
    fig.tight_layout()
    fig.savefig(FIGURES / "disagreements.png", dpi=150)
    plt.close(fig)


def main():
    sys.stdout.reconfigure(encoding="utf-8")       # the Windows console defaults to cp1252
    FIGURES.mkdir(parents=True, exist_ok=True)
    runs, df = load_runs()
    if df.empty:
        raise SystemExit("No runs in outputs/runs - train first.")
    mean, std, table = summary_table(df)
    table.to_csv(OUTPUTS / "results_summary.csv", index=False)
    md = ["| " + " | ".join(table.columns) + " |", "|" + "---|" * len(table.columns)]
    md += ["| " + " | ".join(map(str, r)) + " |" for r in table.itertuples(index=False)]
    (OUTPUTS / "results_summary.md").write_text("\n".join(md) + "\n", encoding="utf-8")

    seed_list = sorted(int(s) for s in df.seed.unique())
    seeds = len(seed_list)
    preds = {h: pd.concat([pd.read_csv(RUNS / f"{h}_seed{s}_predictions.csv").assign(seed=s) for s in seed_list])
             for h in HEADS}
    # Every test image pooled, one set of metrics per seed. Frames of one fruit are correlated,
    # so the spread across seeds says more than a confidence interval over images would.
    per_seed = [{"seed": s, **{h: compute_metrics(p[p.seed == s].grade, p[p.seed == s].pred) for h, p in preds.items()}}
                for s in seed_list]
    pooled = {h: {m: float(np.mean([r[h][m] for r in per_seed])) for m in per_seed[0][h]} for h in HEADS}
    pooled_std = {h: {m: float(np.std([r[h][m] for r in per_seed], ddof=1)) if seeds > 1 else 0.0
                      for m in per_seed[0][h]} for h in HEADS}
    self_collected = int((load_manifest().source == "self_collected").sum())
    web = {
        "seeds": seed_list,
        "self_collected_images": self_collected,
        "splits": SPLITS, "metrics": METRICS, "heads": HEADS,
        "mean": {h: {s: {m: float(mean.loc[(s, h), m]) for m in METRICS} for s in SPLITS} for h in HEADS},
        "std": {h: {s: {m: float(std.loc[(s, h), m]) for m in METRICS} for s in SPLITS} for h in HEADS},
        "pooled": pooled,
        "pooled_std": pooled_std,
        "per_seed": per_seed,
        "confusion": {h: confusion(p.grade, p.pred).tolist() for h, p in preds.items()},
        "history": [{"head": r["head"], "seed": r["seed"], "history": r["history"]} for r in runs],
    }
    (OUTPUTS / "results.json").write_text(json.dumps(web, indent=2))

    fig_dataset()
    fig_samples()
    fig_comparison(mean, std, seeds)
    fig_confusion(preds, seeds)
    fig_error_distance(preds, seeds)
    fig_curves(runs)
    fig_disagreements(preds)
    print(table.to_string(index=False))
    print(f"All test images pooled, per seed (self-collected images: {self_collected}):")
    for r in per_seed:
        print(f"  seed {r['seed']}: " + "  ".join(
            f"{h} acc {r[h]['accuracy']:.3f} MAE {r[h]['mae']:.3f} severe {r[h]['severe_error_rate']:.3f}" for h in HEADS))
    print(f"Figures -> {FIGURES}")


if __name__ == "__main__":
    main()
