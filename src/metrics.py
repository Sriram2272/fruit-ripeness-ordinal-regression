"""Metrics for ordinal grading. Accuracy alone treats every mistake alike; MAE and the
error-distance metrics show *how far* off a prediction is on the ripeness scale."""
import numpy as np
from sklearn.metrics import cohen_kappa_score, confusion_matrix, f1_score

from config import NUM_GRADES


def compute_metrics(y_true, y_pred):
    y_true, y_pred = np.asarray(y_true), np.asarray(y_pred)
    err = np.abs(y_true - y_pred)
    return {
        "n": int(len(y_true)),
        "accuracy": float((err == 0).mean()),
        "mae": float(err.mean()),
        "within_one": float((err <= 1).mean()),     # off by at most one grade
        "severe_error_rate": float((err >= 2).mean()),  # e.g. unripe called ripe
        "qwk": float(cohen_kappa_score(y_true, y_pred, weights="quadratic", labels=list(range(NUM_GRADES)))),
        "macro_f1": float(f1_score(y_true, y_pred, average="macro", labels=sorted(set(y_true)), zero_division=0)),
    }


def confusion(y_true, y_pred):
    return confusion_matrix(y_true, y_pred, labels=list(range(NUM_GRADES)))
