# Viva preparation — Fruit Ripeness Grading via Ordinal Regression

Short answers you should be able to give in your own words. Numbers refer to
`outputs/results_summary.md` (filled in by `src/report.py`).

## 1. Problem and motivation

**Q: What is the problem?**
Given a photo of a banana or tomato, predict its ripeness grade: 0 Unripe, 1 Turning, 2 Ripe, 3 Overripe.

**Q: Why is this an *ordinal* problem and not plain classification?**
The grades have a natural order. Predicting "Overripe" for an "Unripe" fruit is a much worse mistake
than predicting "Turning". Plain classification (softmax + cross-entropy) treats the four grades as
unrelated labels, so every mistake costs the same. Ordinal regression uses the order.

**Q: Where does this matter in practice?**
Sorting lines, supermarket stock rotation, harvest timing, reducing food waste. A grader that is
"one grade off" is often still usable; one that is two or three grades off sends fruit to the wrong place.

## 2. Dataset

**Q: Which data did you use?**
- Fruits-360 (100×100 studio photos, white background): banana and tomato folders whose colour
  reflects ripeness. Mapping lives in `src/config.py` (e.g. Tomato 11 → Unripe, Tomato 7/10 → Turning,
  Tomato 1–5 → Ripe, Tomato 8/9 → Overripe, Banana 3/4 → Overripe).
- Real-world banana photos (Hugging Face `josedonoso/bananas-dataset-v1`, 240 images with captions).
  Captions were mapped to grades with keyword rules; 12 ambiguous captions were dropped.
- A self-collected subset: photos saved from the app into `data/self_collected/<fruit>/<grade>/`.

**Q: Why did you exclude Tomato Yellow, Tomato Maroon, Banana Red?**
Their colour comes from the cultivar, not the ripeness. A ripe yellow tomato would teach the model
that "yellow-orange = turning", which is wrong.

**Q: Why keep only every 3rd Fruits-360 frame?**
Fruits-360 films one fruit rotating; neighbouring frames are almost identical. Subsampling removes
near-duplicates and makes CPU training faster without losing information.

**Q: How are the splits built and why three test sets?**
- *Seen varieties*: Fruits-360's own Test frames of cultivars used in training (easy — same fruits).
- *Unseen varieties*: Tomato 5, 8, 10 and Banana 2 are never used for training (new cultivars).
- *Real-world*: hand-held phone photos with cluttered backgrounds.
Each answers a different question: memorisation, generalisation to new cultivars, and domain shift.

**Q: What is the class imbalance and how did you handle it?**
About 60% of images are "Ripe". A `WeightedRandomSampler` draws every grade equally often during
training, for both models.

**Q: What are the weaknesses of the dataset?**
Grades come from folder/caption rules, not from a physical measurement (sugar, firmness). Fruits-360
has only a few physical fruits per folder. No fully green banana exists in either public source —
which is why a self-collected subset is needed.

## 3. Method

**Q: Which network and why?**
ResNet-18 pretrained on ImageNet. Small enough to train on a CPU, well understood, and transfer
learning works well with a few thousand images. Input 112×112 (Fruits-360 is 100×100).

**Q: Explain the CE head.**
A linear layer 512 → 4 logits, softmax, cross-entropy loss `−log p_y`. Prediction = argmax.

**Q: Explain CORAL.**
CORAL (Cao, Mirjalili & Raschka, 2020) turns K ordered classes into K−1 binary questions:
"is the grade > 0?", "> 1?", "> 2?". A label is encoded as "levels": grade 2 → [1, 1, 0].
The head is one linear layer 512 → 1 (one weight vector *w*, shared) plus K−1 separate biases *b_k*:
`P(y > k) = σ(w·x + b_k)`. Loss = sum of the K−1 binary cross-entropies.
Prediction = number of questions answered "yes" (probability > 0.5).

**Q: Why share the weight vector?**
With the same *w*, the K−1 logits differ only by their bias, so the probabilities are ordered
(`P(y>0) ≥ P(y>1) ≥ P(y>2)` when the biases are ordered). This is *rank consistency*: the model can
never say "not past Turning but past Ripe".

**Q: Why does CORAL penalise far mistakes more?**
If the truth is Turning (levels [1,0,0]) and the model says Overripe ([1,1,1]), two of the three
binary tasks are wrong. Saying Ripe ([1,1,0]) gets only one wrong. So the loss grows with distance.

**Q: How do you get class probabilities and a "ripeness score" from CORAL?**
`P(y = k) = P(y > k−1) − P(y > k)` with `P(y > −1) = 1` and `P(y > K−1) = 0`. The ripeness score
shown in the app is the expected grade `Σ k·P(y=k)`, a continuous value between 0 and 3.

**Q: How did you make the comparison fair?**
Same backbone, same pretrained weights, same splits, same augmentations, same sampler order, same
optimiser, learning rate, schedule and epochs, same model-selection rule (lowest validation MAE),
same three seeds. Only the head and its loss differ.

**Q: Why no hue/saturation augmentation?**
Colour is the main ripeness cue. Hue jitter would turn a green tomato red while keeping the label
"Unripe" — that is label noise we would be creating ourselves.

**Q: Did anything go wrong during training?**
Yes. In the first run, with one learning rate (3·10⁻⁴) and the default CORAL bias initialisation
(1, 2/3, 1/3), CORAL stalled at validation MAE ≈ 0.75: it told green from red but almost never
predicted Turning or Ripe. The three thresholds started only 1/3 apart, and Adam moves a bias by
about one learning rate per step, so they never spread out; the middle grades got probability ≈ 0.07.
Fix: (1) a 10× learning rate for the new head of *both* models, so the comparison stays fair, and
(2) initialise the CORAL biases at logit(0.75), logit(0.5), logit(0.25) so the untrained model
predicts the balanced class prior. After that CORAL reached > 90% validation accuracy after one epoch.

**Q: Training settings?**
AdamW, lr 3·10⁻⁴ for the backbone and 10× (3·10⁻³) for the freshly initialised head, weight decay 10⁻⁴, cosine schedule, batch 32, 8 epochs, CPU.

## 4. Evaluation

**Q: Which metrics and why?**
- Accuracy: share exactly right. Ignores how far off the errors are.
- MAE: mean |true − predicted| in grades. The main ordinal metric.
- Within-one accuracy: share at most one grade off.
- Severe-error rate: share two or more grades off (e.g. unripe called ripe).
- Quadratic weighted kappa (QWK): agreement that penalises distant disagreements quadratically.
- Macro-F1: per-class balance.

**Q: Can accuracy and MAE disagree?**
Yes. A model with slightly lower accuracy can have lower MAE if its mistakes are adjacent-grade
mistakes, and that is exactly what ordinal regression aims for.

**Q: Why three seeds?**
Results vary with random initialisation of the head, sampling order and augmentation. Reporting
mean ± std over seeds shows whether a difference is larger than this noise.

**Q: What does the confusion matrix tell you?**
Rows are true grades, columns predictions. Errors close to the diagonal are cheap, far from it are
expensive. For an ordinal model we expect the mass of errors to hug the diagonal.

## 5. Implementation and demo

**Q: How does the demo work?**
Locally: a Flask server (`app/app.py`) loads both checkpoints and grades uploaded photos. Hosted on
Cloudflare Pages: both models are exported to ONNX, quantised to 8-bit (~11 MB each, under the
25 MiB per-file limit) and run in the browser with ONNX Runtime Web — no server needed.
`src/export_onnx.py` checks the quantised models agree with PyTorch on the test images.

**Q: What is quantisation and did it hurt accuracy?**
Storing weights as 8-bit integers instead of 32-bit floats: 4× smaller files. The export script
prints the agreement with PyTorch and the metrics before/after (see its output).

**Q: How would you add more data?**
Plate IX of the app saves labelled photos to `data/self_collected/`; `prepare_data.py` picks them up
and splits them 70/15/15. Re-run `run_experiments.sh`.

## 6. Results and discussion (fill in from your results)

- Pooled MAE: CE ____ vs CORAL ____ ; accuracy: CE ____ vs CORAL ____.
- Hardest test set: ____ (why: domain shift / unseen cultivar).
- Which model makes fewer severe errors? ____

**Q: Is CORAL always better?**
Not necessarily on accuracy — it optimises ordered thresholds, not the exact class. Its expected
advantage is in MAE and in fewer far-off errors. If the classes are easy to separate (Fruits-360
seen varieties), both models are near-perfect and the difference vanishes.

**Q: Limitations?**
Small and partly synthetic-looking data (studio photos), rule-based labels, no green bananas without
self-collection, single backbone, CPU-limited epochs, near-duplicate frames make "seen" scores optimistic.

**Q: Future work?**
More self-collected photos under real lighting; CORN (conditional ordinal) or ordinal cost-sensitive
losses; a fruit-type head; calibrating the ripeness score to "days until ripe"; detection for multiple
fruits per image; Grad-CAM to check the model looks at the peel and not the background.

## 7. Quick definitions

- **Ordinal regression**: predicting a label on an ordered scale where distances matter but are not numeric.
- **Transfer learning**: starting from weights trained on another task (ImageNet) and fine-tuning.
- **Rank consistency**: cumulative probabilities never increase with the threshold.
- **MAE**: mean absolute error, here in grades.
- **QWK**: Cohen's kappa with quadratic weights (1 − weighted disagreement / chance disagreement).
- **Balanced sampling**: drawing training images so every class appears equally often.
