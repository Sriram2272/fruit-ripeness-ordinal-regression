// Builds docs/Project_Report.docx from outputs/results.json and outputs/figures.
//   cd docs/build && node make_report.js
const fs = require("fs");
const path = require("path");
const {
  AlignmentType, BorderStyle, Document, Footer, HeadingLevel, ImageRun, LevelFormat, Packer, PageBreak,
  PageNumber, Paragraph, ShadingType, Table, TableCell, TableOfContents, TableRow, TextRun, WidthType,
} = require("docx");

const ROOT = path.resolve(__dirname, "..", "..");
const FIG = path.join(ROOT, "outputs", "figures");
const SHOTS = path.join(ROOT, "docs", "screenshots");
const res = JSON.parse(fs.readFileSync(path.join(ROOT, "outputs", "results.json"), "utf8"));
const ds = JSON.parse(fs.readFileSync(path.join(ROOT, "site", "data", "dataset.json"), "utf8"));
const SITE_URL = process.env.SITE_URL || "";
const AUTHOR = process.env.AUTHOR || "Dama Sri Ram";

const GRADES = ["Unripe", "Turning", "Ripe", "Overripe"];
const SPLITS = Object.keys(res.splits);
const P = res.pooled_seed42, M = res.mean, S = res.std, nSeeds = res.seeds.length;
const f3 = v => v.toFixed(3), pct = v => (v * 100).toFixed(1) + "%";
const pm = (h, s, m) => `${f3(M[h][s][m])} ± ${f3(S[h][s][m])}`;

// A4 with 1" margins: content width 11906 - 2*1440 = 9026 DXA
const CONTENT_W = 9026;
const FONT = "Cambria";

const p = (text, o = {}) => new Paragraph({ spacing: { after: 140, line: 300 }, ...o, children: runs(text) });
function runs(text) {
  // **bold** and *italic* inline markup
  if (Array.isArray(text)) return text;
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).filter(Boolean).map(t =>
    t.startsWith("**") ? new TextRun({ text: t.slice(2, -2), bold: true })
      : t.startsWith("*") ? new TextRun({ text: t.slice(1, -1), italics: true }) : new TextRun(t));
}
const h1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const h2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const bullet = t => new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 80, line: 290 }, children: runs(t) });
const numbered = (t, ref = "numbers") => new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 80, line: 290 }, children: runs(t) });
const ref = t => numbered(t, "refs");
const caption = t => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 240 }, children: [new TextRun({ text: t, italics: true, size: 19, color: "6B6358" })] });
const formula = t => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 160 }, children: [new TextRun({ text: t, italics: true, size: 23 })] });

function figure(file, widthIn, cap, dir = FIG) {
  const fp = path.join(dir, file);
  if (!fs.existsSync(fp)) return [p(`[Figure missing: ${file}]`)];
  const buf = fs.readFileSync(fp);
  // PNG width/height live at bytes 16-23
  const w = buf.readUInt32BE(16), hgt = buf.readUInt32BE(20);
  const wpx = widthIn * 96, hpx = Math.round(wpx * hgt / w);
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new ImageRun({ type: "png", data: buf, transformation: { width: wpx, height: hpx }, altText: { title: cap, description: cap, name: file } })] }),
    caption(cap),
  ];
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "D9CFBC" };
const borders = { top: border, bottom: border, left: border, right: border };
function table(header, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (text, w, head, opts = {}) => new TableCell({
    borders, width: { size: w, type: WidthType.DXA },
    shading: head ? { fill: "EFE6D3", type: ShadingType.CLEAR, color: "auto" } : opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ alignment: opts.align || AlignmentType.LEFT, children: [new TextRun({ text: String(text), bold: head || opts.bold, size: 19 })] })],
  });
  return new Table({
    width: { size: total, type: WidthType.DXA }, columnWidths: widths,
    rows: [new TableRow({ tableHeader: true, children: header.map((t, i) => cell(t, widths[i], true)) }),
      ...rows.map(r => new TableRow({ children: r.map((t, i) => (t && typeof t === "object" ? cell(t.text, widths[i], false, t) : cell(t, widths[i], false, { align: i > 0 && /^[\d.±%\s-]+$/.test(String(t)) ? AlignmentType.RIGHT : AlignmentType.LEFT }))) }))],
  });
}
const spacer = () => new Paragraph({ spacing: { after: 120 }, children: [] });

// ── numbers used in the text ────────────────────────────────────────────────
const count = (fruit, split, g) => ds.counts.filter(c => (!fruit || c.fruit === fruit) && (!split || c.split === split) && (g === undefined || c.grade === g)).reduce((a, c) => a + c.n, 0);
const dMae = (P.ce.mae - P.coral.mae) / P.ce.mae;
const better = dMae > 0;
const far = m => m.reduce((a, row, i) => a + row.reduce((b, n, j) => b + (Math.abs(i - j) >= 2 ? n : 0), 0), 0);
const farCE = far(res.confusion_seed42.ce), farCO = far(res.confusion_seed42.coral);

const children = [
  // ── title page ──
  new Paragraph({ spacing: { before: 2400, after: 200 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Fruit Ripeness Grading via Ordinal Regression", size: 52, font: FONT })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: "Comparing a CORAL ordinal-regression CNN with a cross-entropy classifier on identical splits", italics: true, size: 26, color: "6B6358" })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: "Course Project Report — Deep Learning for Computer Vision", size: 24 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: AUTHOR, size: 24, bold: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" }), size: 22, color: "6B6358" })] }),
  ...(SITE_URL ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Live demo: ${SITE_URL}`, size: 22, color: "9A5B34" })] })] : []),
  new Paragraph({ children: [new PageBreak()] }),

  // ── abstract + contents ──
  h1("Abstract"),
  p(`Fruit ripeness is graded on an ordered scale — unripe, turning, ripe, overripe — yet image classifiers are usually trained as if the grades were unrelated categories. This project treats ripeness grading of bananas and tomatoes as an ordinal-regression problem. A ResNet-18 pretrained on ImageNet is fine-tuned twice under identical conditions: once with a standard softmax cross-entropy head and once with a CORAL (Consistent Rank Logits) ordinal head. The dataset of ${ds.total.toLocaleString()} images combines Fruits-360 studio photographs, mapped to four grades by colour and condition, with real-world banana photographs and a pipeline for a self-collected subset. Three test sets measure performance on seen cultivars, held-out cultivars and real-world photos. Over all test images (seed 42), the ordinal model reaches an MAE of ${f3(P.coral.mae)} grades against ${f3(P.ce.mae)} for the baseline (${better ? (dMae * 100).toFixed(0) + "% lower" : (-dMae * 100).toFixed(0) + "% higher"}), with exact accuracy of ${pct(P.coral.accuracy)} versus ${pct(P.ce.accuracy)} and severe errors (two or more grades off) of ${pct(P.coral.severe_error_rate)} versus ${pct(P.ce.severe_error_rate)}. Results are averaged over ${nSeeds} seed${nSeeds > 1 ? "s" : ""}. Both models are deployed in a sketchbook-style web application that grades photographs in the browser.`),
  new Paragraph({ children: [new PageBreak()] }),
  h1("Contents"),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  p("*Right-click the table and choose “Update field” in Word to refresh page numbers.*"),
  new Paragraph({ children: [new PageBreak()] }),

  // ── 1 introduction ──
  h1("1. Introduction"),
  p("Ripeness determines when fruit is harvested, how it is stored and shipped, and when it is sold or discarded. Grading is still largely manual and subjective. Computer vision offers a fast, non-destructive alternative: the peel colour, spotting and texture of bananas and tomatoes change visibly as they ripen."),
  p("Most image-based grading systems are framed as multi-class classification. That framing ignores an essential property of the labels: they are **ordered**. A grader that calls an unripe tomato overripe has made a far more serious error than one that calls it turning, but softmax cross-entropy penalises both mistakes identically. Ordinal regression methods build the order into the model and the loss, so that predictions that are wrong tend to be wrong by less."),
  p("This project implements and compares the two approaches on the same data, with the same network and training procedure, so that the effect of the ordinal formulation can be measured directly."),
  h2("1.1 Objectives"),
  numbered("Build a four-grade ripeness dataset for banana and tomato from Fruits-360, extended with real-world banana photographs and a self-collected subset."),
  numbered("Train an ImageNet-pretrained ResNet-18 with (a) a cross-entropy classification head and (b) a CORAL ordinal-regression head, under identical conditions."),
  numbered("Compare the two on identical splits using accuracy and mean absolute error (MAE), supported by severe-error rate, within-one accuracy, quadratic weighted kappa and macro-F1, over several random seeds."),
  numbered("Deliver a working demonstration that grades a photograph with both models."),

  // ── 2 problem statement ──
  h1("2. Problem Statement"),
  p("Given an RGB image x of a single banana or tomato, predict its ripeness grade y ∈ {0 Unripe, 1 Turning, 2 Ripe, 3 Overripe}. The grades are ordinal: there is a meaningful order but no meaningful numeric distance between them."),
  p("The research question is: **does training with an ordinal-regression loss reduce the size of grading errors compared with standard cross-entropy, without sacrificing exact accuracy, when everything else is held constant?**"),
  p("The cost of a mistake is taken to grow with its distance on the scale. The primary metric is therefore the mean absolute error between predicted and true grade; exact accuracy is reported alongside it because the two can disagree."),

  // ── 3 dataset ──
  h1("3. Dataset"),
  h2("3.1 Sources"),
  p("**Fruits-360** (Oltean, 100×100 version) contains studio photographs of single fruits rotating on a white background, organised in folders by variety. The banana and tomato folders were downloaded with a sparse Git checkout. Each folder whose colour reflects ripeness was mapped to a grade after visual inspection of every folder (Table 1). Folders whose colour comes from the cultivar rather than ripeness — Tomato Yellow, Tomato Maroon, Cherry Orange, Cherry Yellow, Cherry Maroon and Banana Red — were excluded, because a ripe yellow tomato would otherwise teach the model that yellow-orange means “turning”."),
  table(["Grade", "Tomato folders", "Banana folders"], [
    ["0 Unripe", "Tomato 11 (fully green)", "— (none in Fruits-360)"],
    ["1 Turning", "Tomato 7, Tomato 10 (orange-pink)", "—"],
    ["2 Ripe", "Tomato 1–5, Cherry Red 1, Heart 1", "Banana 1, Banana 2, Lady Finger 1"],
    ["3 Overripe", "Tomato 8, Tomato 9 (dark, wrinkled, rot)", "Banana 3 (sugar spots), Banana 4 (brown)"],
  ], [1700, 3900, 3426]),
  caption("Table 1. Mapping of Fruits-360 folders to ripeness grades."),
  p("Fruits-360 records each fruit while it rotates, so consecutive frames are almost identical. Only every third frame is kept, which removes near-duplicates and reduces training time."),
  p(`**Real-world bananas.** The public Hugging Face dataset josedonoso/bananas-dataset-v1 provides 240 phone photographs of bananas on kitchen surfaces and in hands, each with a free-text caption. Captions were mapped to grades with ordered keyword rules: “unripe / partially green” → Turning; “rotten / decomposing / mostly black / overripe” → Overripe; remaining “ripe / yellow” → Ripe. Twelve captions with no ripeness information (e.g. “banana missing its tip”) were discarded. Fully green bananas do not occur in this set either.`),
  p("**Self-collected subset.** The project includes a collection workflow: photographs are saved from the web application (or copied by hand) into data/self_collected/<fruit>/<grade>_<name>/ and are automatically split 70/15/15 into training, validation and the real-world test set the next time the pipeline runs. This subset is the only source of fully green bananas."),
  ...figure("samples.png", 6.3, "Figure 1. Example images for each fruit and grade (studio and real-world). No public source contains unripe bananas."),
  h2("3.2 Splits"),
  p("Five splits are built by src/prepare_data.py and recorded in data/processed/manifest.csv, so that both models use exactly the same images:"),
  bullet("**Train / Validation** — Fruits-360 Training frames of the training varieties plus the real-world banana training split; 15% of each (source, grade) group is held out for validation."),
  bullet("**Test · seen varieties** — Fruits-360 Test frames of the same cultivars (new frames of the same fruits)."),
  bullet("**Test · unseen varieties** — every frame of Tomato 5, Tomato 8, Tomato 10 and Banana 2, which are never used for training; this measures generalisation to new cultivars."),
  bullet("**Test · real-world** — the real-world banana test split plus 15% of any self-collected photographs; this measures robustness to backgrounds, lighting and hands."),
  table(["Split", "Tomato", "Banana", "Unripe", "Turning", "Ripe", "Overripe", "Total"],
    ["train", "val", "test_seen", "test_unseen", "test_real"].map(sp => [sp, count("tomato", sp), count("banana", sp), ...[0, 1, 2, 3].map(g => count(null, sp, g)), count(null, sp)]),
    [1500, 1000, 1000, 1000, 1100, 1000, 1200, 1226]),
  caption("Table 2. Images per split, fruit and grade."),
  ...figure("dataset.png", 6.3, "Figure 2. Grade distribution per split. Ripe dominates; training therefore uses a grade-balanced sampler."),

  // ── 4 methodology ──
  h1("4. Methodology"),
  h2("4.1 Backbone"),
  p("Both models use a ResNet-18 pretrained on ImageNet, with its final classification layer replaced by the head under study. Transfer learning is appropriate for a dataset of a few thousand images, and ResNet-18 is small enough to fine-tune on a CPU. Images are resized to 112×112 and normalised with the ImageNet mean and standard deviation. The backbone produces a 512-dimensional feature vector h(x)."),
  h2("4.2 Baseline: cross-entropy classification"),
  p("A linear layer maps h(x) to four logits z, converted to probabilities by a softmax. The loss is the negative log-probability of the true grade and the prediction is the most probable grade:"),
  formula("L_CE = − log softmax(z)_y        ŷ = argmax_k softmax(z)_k"),
  p("Nothing in this formulation knows that grade 1 lies between grades 0 and 2."),
  h2("4.3 Ordinal model: CORAL"),
  p("CORAL (Cao, Mirjalili & Raschka, 2020) reformulates a K-class ordinal problem as K − 1 binary problems “is y > k?” for k = 0 … K − 2. A label is encoded as a vector of *levels*: for K = 4, grade 2 becomes [1, 1, 0]. The head is a single linear unit with weight vector w, shared by all K − 1 tasks, plus one bias per task:"),
  formula("P(y > k | x) = σ( w·h(x) + b_k ),     k = 0, 1, 2"),
  p("The loss is the sum of the K − 1 binary cross-entropies between these probabilities and the levels. A prediction that is two grades from the truth answers two of the binary questions wrongly and is penalised roughly twice as much as one that is a single grade off. The predicted grade is the number of tasks whose probability exceeds 0.5:"),
  formula("ŷ = Σ_k 1[ P(y > k | x) > 0.5 ]"),
  p("Because the weight vector is shared and only the biases differ, the cumulative probabilities are ordered whenever the biases are ordered, so the model cannot output contradictory answers such as “not beyond Turning but beyond Ripe”. This property is called rank consistency. Class probabilities are recovered as P(y = k) = P(y > k − 1) − P(y > k), and the application reports a continuous ripeness score, the expected grade Σ k·P(y = k)."),
  h2("4.4 Training procedure"),
  p("To isolate the effect of the head, every other component is identical for both models (Table 3)."),
  table(["Setting", "Value"], [
    ["Optimiser", "AdamW, learning rate 3·10⁻⁴ for the backbone and 3·10⁻³ (10×) for the new head, weight decay 10⁻⁴"],
    ["Schedule", "Cosine annealing over all iterations"],
    ["Epochs / batch", "8 epochs, batch size 32"],
    ["Sampling", "WeightedRandomSampler giving every grade equal probability"],
    ["Augmentation", "RandomResizedCrop (scale 0.6–1), horizontal and vertical flips, ±20° rotation, brightness and contrast jitter 0.25"],
    ["Model selection", "Epoch with the lowest validation MAE (same rule for both heads)"],
    ["Seeds", res.seeds.join(", ")],
    ["Hardware", "CPU only (PyTorch 2, torchvision)"],
  ], [2600, 6426]),
  caption("Table 3. Shared training configuration."),
  p("**Head learning rate and threshold initialisation.** In a first experiment both heads were trained with a single learning rate of 3·10⁻⁴ and the CORAL biases were initialised at 1, 2/3 and 1/3, the default of the reference implementation. The cross-entropy model trained normally, but CORAL stalled at a validation MAE of about 0.75: it separated green from red fruit but predicted almost no Turning or Ripe images. The three thresholds started only 1/3 apart, and because Adam moves each bias by roughly the learning rate per step, they could not spread during training, leaving the middle grades with probabilities near 0.07. Two changes fixed this: the freshly initialised head of **both** models is trained with a 10× learning rate (a standard fine-tuning practice), and the CORAL biases are initialised at logit(0.75), logit(0.5) and logit(0.25), so that the untrained model reproduces the balanced class prior. All reported results use this corrected setup for both heads."),
  p("Hue and saturation jitter are deliberately **not** used: colour is the principal ripeness cue, and shifting the hue would turn a green tomato red while keeping its label “Unripe”, injecting label noise."),
  h2("4.5 Evaluation metrics"),
  bullet("**Accuracy** — fraction of images whose grade is predicted exactly."),
  bullet("**MAE** — mean |y − ŷ| in grades; the primary ordinal metric."),
  bullet("**Within-one accuracy** — fraction predicted at most one grade away."),
  bullet("**Severe-error rate** — fraction predicted two or more grades away (e.g. unripe graded ripe)."),
  bullet("**Quadratic weighted kappa (QWK)** — chance-corrected agreement with quadratically growing penalties for distant disagreements."),
  bullet("**Macro-F1** — unweighted mean of per-grade F1, sensitive to minority grades."),
  p(`Each model is trained with ${nSeeds} seed${nSeeds > 1 ? "s" : ""}; tables report the mean ± standard deviation across seeds. Confusion matrices and error-distance distributions use seed 42.`),

  // ── 5 implementation ──
  h1("5. Implementation"),
  p("The project is written in Python with PyTorch and organised as small, single-purpose modules:"),
  table(["File", "Role"], [
    ["src/config.py", "Paths, grade names, Fruits-360 folder → grade mapping"],
    ["src/prepare_data.py", "Builds the manifest and the five splits; extracts the real-world banana images"],
    ["src/dataset.py", "Dataset class, transforms, grade-balanced sampler"],
    ["src/models.py", "ResNet-18 with CE or CORAL head; CORAL loss and prediction rule"],
    ["src/metrics.py", "Accuracy, MAE, within-one, severe errors, QWK, macro-F1"],
    ["src/train.py", "Trains one head with one seed and evaluates all test sets"],
    ["src/report.py", "Aggregates runs into tables, figures and results.json"],
    ["src/export_onnx.py", "Exports both models to 8-bit ONNX and checks agreement with PyTorch"],
    ["app/app.py, app/static/index.html", "Flask server and the sketchbook web interface"],
    ["run_experiments.sh", "End-to-end pipeline: data → 2 heads × seeds → report"],
  ], [3300, 5726]),
  caption("Table 4. Code structure."),
  h2("5.1 Demonstration application"),
  p("The results and both models are presented in a sketchbook-style web application of nine “plates”: title and index, the problem, the dataset with a tray of test specimens, the method, a live grading bench, results, confusion matrices, training notes and conclusions. Pages turn with a curled-page animation; a draggable magnifying glass enlarges any specimen; zoom, pointer tilt and keyboard navigation are supported, and the layout collapses to a single column on phones."),
  p("On the grading bench a user drops or uploads a photograph; both models grade it side by side, showing the predicted grade, the probability of each grade, the continuous ripeness score and the inference time. The last plate lets the user label and save a photograph into the self-collected subset."),
  p(`The application runs locally with Flask and is also hosted as a static site on Cloudflare Pages${SITE_URL ? ` (${SITE_URL})` : ""}. For hosting, both networks are exported to ONNX and their weights quantised to 8 bits, reducing each model from about 45 MB to about 11 MB (below Cloudflare’s 25 MiB file limit); ONNX Runtime Web then runs them in the visitor’s browser, so no server is required. The export script verifies that the quantised models give the same grades as PyTorch on the test images.`),
  ...figure("bench.png", 6.0, "Figure 3. The grading bench of the sketchbook application.", SHOTS),

  // ── 6 results ──
  h1("6. Results"),
  h2("6.1 Overall comparison"),
  table(["Metric (all test images, seed 42)", "Cross-entropy", "CORAL"], [
    ["Accuracy", pct(P.ce.accuracy), pct(P.coral.accuracy)],
    ["MAE (grades)", f3(P.ce.mae), f3(P.coral.mae)],
    ["Within-one accuracy", pct(P.ce.within_one), pct(P.coral.within_one)],
    ["Severe-error rate (≥ 2 grades)", pct(P.ce.severe_error_rate), pct(P.coral.severe_error_rate)],
    ["Quadratic weighted kappa", f3(P.ce.qwk), f3(P.coral.qwk)],
    ["Macro-F1", f3(P.ce.macro_f1), f3(P.coral.macro_f1)],
  ], [4426, 2300, 2300]),
  caption(`Table 5. Pooled results on all ${P.ce.n.toLocaleString()} test images (seed 42).`),
  h2("6.2 Per test set"),
  table(["Test set", "Model", "Accuracy", "MAE", "Severe", "QWK"],
    SPLITS.flatMap(s => ["ce", "coral"].map(h => [h === "ce" ? res.splits[s] : "", h === "ce" ? "Cross-entropy" : "CORAL", pm(h, s, "accuracy"), pm(h, s, "mae"), pm(h, s, "severe_error_rate"), pm(h, s, "qwk")])),
    [1900, 1450, 1420, 1420, 1418, 1418]),
  caption(`Table 6. Mean ± standard deviation over ${nSeeds} seed${nSeeds > 1 ? "s" : ""}.`),
  ...figure("comparison.png", 6.3, "Figure 4. Accuracy, MAE and severe-error rate per test set (mean ± std over seeds)."),
  h2("6.3 Error structure"),
  ...figure("confusion.png", 5.8, "Figure 5. Confusion matrices on all test images (seed 42). Rows are true grades."),
  p(`Across all test images the baseline makes ${farCE} errors of two or more grades and the ordinal model ${farCO}. The distribution of error distances (Figure 6) shows where each model’s mistakes fall on the scale.`),
  ...figure("error_distance.png", 4.6, "Figure 6. Share of test images by error distance (seed 42)."),
  ...figure("training_curves.png", 6.3, "Figure 7. Validation MAE and accuracy per epoch for every run."),
  ...figure("disagreements.png", 6.3, "Figure 8. Unseen-variety and real-world images on which the two models disagree."),

  // ── 7 discussion ──
  h1("7. Discussion"),
  p(`**Effect of the ordinal loss.** With the backbone, data and training procedure held fixed, replacing the cross-entropy head with CORAL ${better ? "reduced" : "did not reduce"} the pooled MAE (${f3(P.ce.mae)} → ${f3(P.coral.mae)}) and changed the severe-error rate from ${pct(P.ce.severe_error_rate)} to ${pct(P.coral.severe_error_rate)}. Exact accuracy moved from ${pct(P.ce.accuracy)} to ${pct(P.coral.accuracy)}. This is the pattern ordinal regression is designed to produce: the loss charges more for distant mistakes, so the network learns a representation in which ripeness increases along a single direction (the shared weight vector w), and errors concentrate next to the diagonal of the confusion matrix.`),
  p(`**Which test sets differ.** On the seen-variety test set both models are close to perfect, because its frames come from the same physical fruits as the training frames; this set mainly confirms that training succeeded. The informative comparisons are the held-out cultivars (MAE ${f3(M.ce.test_unseen.mae)} vs ${f3(M.coral.test_unseen.mae)}) and the real-world banana photographs (MAE ${f3(M.ce.test_real.mae)} vs ${f3(M.coral.test_real.mae)}), where the models must generalise beyond what they have seen.`),
  p("**Accuracy versus MAE.** The two metrics answer different questions and can disagree: a model may predict the exact grade slightly less often yet be closer on average. For a sorting application the size of the error matters, so MAE and the severe-error rate are the more relevant measures; reporting both avoids over-claiming."),
  p("**Cost.** The CORAL head has fewer parameters than the softmax head (512 + 3 versus 512 × 4 + 4) and the same inference time, so the ordinal formulation comes at no computational cost."),
  h2("7.1 Limitations"),
  bullet("Grades are derived from folder names and captions after visual inspection, not from physical measurements such as soluble solids, firmness or days to ripeness."),
  bullet("Each Fruits-360 folder contains only a few physical fruits photographed on a white background, so seen-variety scores are optimistic and the studio images differ from field conditions."),
  bullet("No public source contains fully green bananas; the Unripe banana grade depends entirely on the self-collected subset."),
  bullet("The real-world test set is small, so its metrics have wide uncertainty; the seed-to-seed standard deviation gives an indication of this variability."),
  bullet("Training budget was limited to 8 CPU epochs with one backbone; larger networks or longer training might narrow or widen the gap."),

  // ── 8 conclusion ──
  h1("8. Conclusion"),
  p(`This project framed fruit ripeness grading as an ordinal problem and tested whether that framing matters in practice. Two ResNet-18 models that differ only in their final layer and loss were trained and evaluated on identical splits. The ordinal CORAL model achieved a pooled MAE of ${f3(P.coral.mae)} grades against ${f3(P.ce.mae)} for the cross-entropy baseline, with ${pct(P.coral.severe_error_rate)} versus ${pct(P.ce.severe_error_rate)} of predictions two or more grades off and exact accuracy of ${pct(P.coral.accuracy)} versus ${pct(P.ce.accuracy)}. The project also produced a reproducible pipeline, a data-collection workflow for extending the dataset, and a hosted application that grades photographs with both models directly in the browser.`),
  h2("8.1 Future work"),
  bullet("Collect at least 50 photographs per fruit and grade under varied lighting and backgrounds, prioritising unripe bananas."),
  bullet("Compare further ordinal methods (CORN, cumulative-link models, cost-sensitive cross-entropy)."),
  bullet("Calibrate the continuous ripeness score against measured days-until-ripe."),
  bullet("Use Grad-CAM to verify that the networks attend to the peel rather than the background."),
  bullet("Extend to detection so that several fruits in one image can be graded individually."),

  // ── references ──
  h1("References"),
  ref("W. Cao, V. Mirjalili and S. Raschka, “Rank consistent ordinal regression for neural networks with application to age estimation,” Pattern Recognition Letters, vol. 140, pp. 325–331, 2020."),
  ref("X. Shi, W. Cao and S. Raschka, “Deep neural networks for rank-consistent ordinal regression based on conditional probabilities (CORN),” Pattern Analysis and Applications, 2023."),
  ref("H. Mureșan and M. Oltean, “Fruit recognition from images using deep learning,” Acta Universitatis Sapientiae, Informatica, vol. 10, no. 1, pp. 26–42, 2018 (Fruits-360 dataset)."),
  ref("K. He, X. Zhang, S. Ren and J. Sun, “Deep residual learning for image recognition,” CVPR, 2016."),
  ref("J. Cohen, “Weighted kappa: nominal scale agreement with provision for scaled disagreement or partial credit,” Psychological Bulletin, vol. 70, no. 4, 1968."),
  ref("J. Donoso, bananas-dataset-v1, Hugging Face Datasets, https://huggingface.co/datasets/josedonoso/bananas-dataset-v1."),
  ref("ONNX Runtime Web, Microsoft, https://onnxruntime.ai/docs/tutorials/web/."),

  // ── appendix ──
  h1("Appendix A. Reproducing the results"),
  p("From the project folder (Windows, Git Bash):"),
  ...[
    "python -m venv .venv",
    ".venv/Scripts/python -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu",
    ".venv/Scripts/python -m pip install -r requirements.txt",
    "bash run_experiments.sh",
    ".venv/Scripts/python app/app.py      # http://127.0.0.1:5000",
  ].map(c => new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: c, font: "Consolas", size: 18 })] })),
];

const doc = new Document({
  creator: AUTHOR, title: "Fruit Ripeness Grading via Ordinal Regression",
  styles: {
    default: { document: { run: { font: FONT, size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 32, color: "2B2721", font: FONT }, paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, color: "9A5B34", font: FONT }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [
    { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
    { reference: "refs", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "[%1]", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 450 } } } }] },
    { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] },
  ] },
  features: { updateFields: true },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "6B6358" })] })] }) },
    children,
  }],
});

Packer.toBuffer(doc).then(buf => {
  const out = path.join(ROOT, "docs", "Project_Report.docx");
  fs.writeFileSync(out, buf);
  console.log("wrote", out);
});
