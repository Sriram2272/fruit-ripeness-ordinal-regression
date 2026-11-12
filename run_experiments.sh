#!/usr/bin/env bash
# Full experiment: both heads x 3 seeds on identical splits, then the comparison report.
# Usage (from the project folder):  bash run_experiments.sh
set -e
cd "$(dirname "$0")/src"
PY=../.venv/Scripts/python
[ -x "$PY" ] || PY=python

$PY prepare_data.py
for seed in 42 7 123; do
  for head in ce coral; do
    $PY train.py --head "$head" --seed "$seed" --epochs 8
  done
done
$PY report.py
