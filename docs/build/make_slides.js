// Builds docs/Presentation.pptx from outputs/results.json and outputs/figures.
//   cd docs/build && npm install && node make_slides.js
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

const ROOT = path.resolve(__dirname, "..", "..");
const FIG = path.join(ROOT, "outputs", "figures");
const SHOTS = path.join(ROOT, "docs", "screenshots");
const res = JSON.parse(fs.readFileSync(path.join(ROOT, "outputs", "results.json"), "utf8"));
const ds = JSON.parse(fs.readFileSync(path.join(ROOT, "site", "data", "dataset.json"), "utf8"));
const SITE_URL = process.env.SITE_URL || "";

const INK = "2B2721", PAPER = "F8F3E8", PAPER2 = "EFE6D3", EARTH = "9A5B34", MUTED = "6B6358";
const CE = "1F6FB2", CORAL = "B4532A", GRADE = ["7D9A3A", "D8933A", "C63C2B", "6E3A26"];
const SHADES = ["D9C7A7", "B9996B", "8B6A3E", "4E3A22"];
const GRADES = ["Unripe", "Turning", "Ripe", "Overripe"];
const SPLITS = Object.keys(res.splits);
const P = res.pooled_seed42, M = res.mean, S = res.std;
const f3 = v => v.toFixed(3), pct = v => (v * 100).toFixed(1) + "%";
const nSeeds = res.seeds.length;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";                    // 13.33 x 7.5 in
pres.title = "Fruit Ripeness Grading via Ordinal Regression";
pres.theme = { headFontFace: "Cambria", bodyFontFace: "Calibri" };
const W = 13.33, H = 7.5, MX = 0.6;

pres.defineSlideMaster({
  title: "CONTENT", background: { color: PAPER },
  objects: [
    // motif: the four-grade ripeness scale, top right of every content slide
    ...GRADES.map((_, g) => ({ ellipse: { x: W - MX - 1.05 + g * 0.28, y: 0.42, w: 0.17, h: 0.17, fill: { color: GRADE[g] }, line: { color: GRADE[g] } } })),
  ],
  slideNumber: { x: W - MX - 0.6, y: H - 0.45, w: 0.6, h: 0.3, fontSize: 10, color: MUTED, align: "right" },
});
pres.defineSlideMaster({ title: "DARK", background: { color: INK }, objects: [] });

const T = (s, text, o) => s.addText(text, { isTextBox: true, fontFace: "Calibri", color: INK, fontSize: 15, margin: 0, valign: "top", ...o });
function title(s, text, kicker) {
  if (kicker) T(s, kicker, { x: MX, y: 0.32, w: 9, h: 0.35, fontSize: 13, italic: true, color: EARTH, fontFace: "Cambria" });
  T(s, text, { x: MX, y: 0.68, w: W - 2 * MX - 1.4, h: 0.8, fontSize: 34, fontFace: "Cambria", valign: "middle" });
}
const bullets = (items, o = {}) => items.map((t, i) => ({ text: t, options: { bullet: { indent: 18 }, breakLine: i < items.length - 1, paraSpaceAfter: 8, ...o } }));
function card(s, x, y, w, h, fill = "FFFFFF") {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: "E2D8C4", width: 0.75 },
    shadow: { type: "outer", color: "5A4030", opacity: 0.12, blur: 6, offset: 2, angle: 90 } });
}
function img(s, file, x, y, w, h) {
  const p = path.join(FIG, file);
  if (fs.existsSync(p)) s.addImage({ path: p, x, y, w, h, sizing: { type: "contain", w, h } });
}
const chartText = { catAxisLabelColor: MUTED, valAxisLabelColor: MUTED, catAxisLabelFontFace: "Calibri", valAxisLabelFontFace: "Calibri",
  catAxisLabelFontSize: 11, valAxisLabelFontSize: 10, dataLabelFontFace: "Calibri", dataLabelFontSize: 10, dataLabelColor: INK,
  valGridLine: { color: "E4DCCB", size: 0.5 }, catGridLine: { style: "none" }, legendFontFace: "Calibri", legendFontSize: 11, legendColor: INK,
  titleFontFace: "Cambria", titleFontSize: 14, titleColor: INK, plotArea: { fill: { color: PAPER } } };

// ── 1 · title ───────────────────────────────────────────────────────────────
{
  const s = pres.addSlide({ masterName: "DARK" });
  T(s, "Course project · Deep learning for computer vision", { x: MX, y: 0.8, w: 10, h: 0.4, fontSize: 14, color: "C9B99C", italic: true, fontFace: "Cambria" });
  T(s, "Fruit Ripeness Grading\nvia Ordinal Regression", { x: MX, y: 1.5, w: 11, h: 2.2, fontSize: 48, color: PAPER, fontFace: "Cambria" });
  T(s, "A CNN trained with an ordinal (CORAL) loss versus a standard cross-entropy classifier, on identical splits", { x: MX, y: 3.85, w: 10.5, h: 0.8, fontSize: 18, color: "D8CCB4" });
  GRADES.forEach((g, i) => {
    s.addShape(pres.shapes.OVAL, { x: MX + i * 1.55, y: 5.15, w: 0.55, h: 0.55, fill: { color: GRADE[i] }, line: { color: GRADE[i] } });
    T(s, g, { x: MX + i * 1.55 - 0.3, y: 5.8, w: 1.15, h: 0.35, fontSize: 13, color: "D8CCB4", align: "center", italic: true, fontFace: "Cambria" });
  });
  T(s, "Dama Sri Ram", { x: MX, y: 6.55, w: 6, h: 0.4, fontSize: 15, color: PAPER });
  s.addNotes("Introduce the project: we grade the ripeness of bananas and tomatoes from a photo. The key idea is that ripeness is an ordered scale, so we compare a model that knows about the order (CORAL) with one that does not (cross-entropy).");
}

// ── 2 · problem ─────────────────────────────────────────────────────────────
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Not all mistakes are equal", "The problem");
  T(s, bullets([
    "Ripeness has an order: Unripe < Turning < Ripe < Overripe.",
    "Plain classification (softmax + cross-entropy) treats the four grades as unrelated labels — calling an unripe fruit overripe costs the same as calling it turning.",
    "In a sorting line, a one-grade slip is tolerable; a three-grade slip sends fruit to the wrong place.",
    "Ordinal regression uses the order, so its mistakes should land next to the truth.",
  ]), { x: MX, y: 1.75, w: 5.6, h: 4.6, fontSize: 17 });
  const grid = (x, label, f, color) => {
    T(s, label, { x, y: 1.75, w: 3, h: 0.4, fontSize: 16, fontFace: "Cambria", color });
    const rows = [[{ text: "true \\ pred", options: { italic: true, color: MUTED } }, ...GRADES.map(g => ({ text: g.slice(0, 4), options: { italic: true, color: MUTED } }))]];
    GRADES.forEach((g, i) => rows.push([{ text: g, options: { color: MUTED } }, ...GRADES.map((_, j) => {
      const v = f(i, j);
      return { text: String(v), options: { align: "center", bold: i === j, fill: { color: v === 0 ? "FFFFFF" : ["FFFFFF", "F1DECD", "E3BE9F", "D29C73"][v] } } };
    })]));
    s.addTable(rows, { x, y: 2.2, w: 3.0, colW: [0.95, 0.5125, 0.5125, 0.5125, 0.5125], fontSize: 11, fontFace: "Calibri", color: INK, border: { type: "solid", color: "E2D8C4", pt: 0.75 }, rowH: 0.36 });
  };
  grid(6.7, "Cost of a mistake · cross-entropy", (i, j) => (i === j ? 0 : 1), CE);
  grid(9.95, "Cost of a mistake · ordinal", (i, j) => Math.abs(i - j), CORAL);
  T(s, "Every wrong cell costs 1 on the left; on the right the cost grows with the distance |true − predicted|.", { x: 6.7, y: 4.25, w: 6.1, h: 0.6, fontSize: 13, color: MUTED, italic: true });
  card(s, 6.7, 5.1, 6.1, 1.4, "FFFFFF");
  T(s, [{ text: "Accuracy", options: { bold: true } }, { text: " = share graded exactly right\n" }, { text: "MAE", options: { bold: true } }, { text: " = mean |true − predicted|, in grades — the main ordinal metric" }],
    { x: 6.95, y: 5.3, w: 5.6, h: 1.0, fontSize: 15, valign: "middle" });
  s.addNotes("Explain with the two cost tables. Cross-entropy only checks whether the right box was ticked. The ordinal view says the further away the prediction, the worse. That is why we report MAE alongside accuracy.");
}

// ── 3 · objectives ──────────────────────────────────────────────────────────
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Objectives", "What the project sets out to do");
  const obj = [
    ["Build the data", "A 4-grade ripeness dataset for banana and tomato from Fruits-360, extended with real-world banana photos and a self-collected subset."],
    ["Train two graders", "The same ImageNet-pretrained ResNet-18, once with a cross-entropy head and once with a CORAL ordinal head."],
    ["Compare fairly", "Identical splits, augmentations, sampler, optimiser and seeds; report accuracy, MAE, severe errors and QWK."],
    ["Demonstrate it", "A sketchbook web app that grades a photo with both models — locally and hosted, running in the browser."],
  ];
  obj.forEach(([h, b], i) => {
    const x = MX + i * 3.08;
    card(s, x, 1.9, 2.85, 4.3);
    s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: 2.2, w: 0.62, h: 0.62, fill: { color: GRADE[i] }, line: { color: GRADE[i] } });
    T(s, String(i + 1), { x: x + 0.3, y: 2.2, w: 0.62, h: 0.62, fontSize: 20, color: "FFFFFF", align: "center", valign: "middle", bold: true, fontFace: "Cambria" });
    T(s, h, { x: x + 0.3, y: 3.05, w: 2.3, h: 0.5, fontSize: 20, fontFace: "Cambria" });
    T(s, b, { x: x + 0.3, y: 3.6, w: 2.3, h: 2.4, fontSize: 14, color: "4A443B" });
  });
  s.addNotes("Four objectives: data, two models, a fair comparison, and a working demo.");
}

// ── 4 · data sources ────────────────────────────────────────────────────────
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Three sources of specimens", "Dataset");
  const src = [
    ["Fruits-360", "Studio photos, white background. Folders mapped to a grade by colour and condition (Tomato 11 → Unripe, Tomato 7/10 → Turning, Tomato 9 → Overripe). Cultivar colours (yellow, maroon) excluded."],
    ["Real-world bananas", "240 phone photos with captions such as “peel partially green” or “rotten”, mapped to grades by keyword rules; 12 ambiguous captions dropped."],
    ["Self-collected", "Photos saved from the app into data/self_collected/<fruit>/<grade>/ and split 70/15/15. Needed for fully green bananas, which no public source has."],
  ];
  src.forEach(([h, b], i) => {
    const x = MX + i * 4.1;
    card(s, x, 1.75, 3.85, 2.05);
    T(s, h, { x: x + 0.25, y: 1.9, w: 3.4, h: 0.45, fontSize: 18, fontFace: "Cambria", color: EARTH });
    T(s, b, { x: x + 0.25, y: 2.38, w: 3.4, h: 1.35, fontSize: 13, color: "4A443B" });
  });
  img(s, "samples.png", MX, 4.0, W - 2 * MX, 3.0);
  s.addNotes("Fruits-360 gives clean studio images; the Hugging Face banana set adds real phone photos; the self-collected subset fills the gap of green bananas. The grid shows real examples per grade.");
}

// ── 5 · splits ──────────────────────────────────────────────────────────────
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  title(s, `${ds.total.toLocaleString()} images, five splits`, "Dataset");
  const order = ["train", "val", "test_seen", "test_unseen", "test_real"];
  const labels = ["Train", "Val", "Test seen", "Test unseen", "Test real"];
  const count = (sp, g) => ds.counts.filter(c => c.split === sp && c.grade === g).reduce((a, c) => a + c.n, 0);
  s.addChart(pres.charts.BAR, GRADES.map((g, k) => ({ name: g, labels, values: order.map(sp => count(sp, k)) })), {
    x: MX, y: 1.7, w: 7.2, h: 5.1, barDir: "col", barGrouping: "stacked", chartColors: SHADES, barGapWidthPct: 60,
    showLegend: true, legendPos: "b", showTitle: true, title: "Images per split and grade (both fruits)", ...chartText,
  });
  const tests = [
    ["Seen varieties", "New frames of cultivars used in training. Tests memorisation — expected to be easy."],
    ["Unseen varieties", "Tomato 5, 8, 10 and Banana 2 held out completely. Tests generalisation to new cultivars."],
    ["Real-world bananas", "Hand-held phone photos, cluttered backgrounds. Tests domain shift."],
  ];
  tests.forEach(([h, b], i) => {
    card(s, 8.2, 1.75 + i * 1.62, 4.5, 1.45);
    T(s, h, { x: 8.45, y: 1.88 + i * 1.62, w: 4.0, h: 0.4, fontSize: 17, fontFace: "Cambria", color: EARTH });
    T(s, b, { x: 8.45, y: 2.3 + i * 1.62, w: 4.0, h: 0.85, fontSize: 13, color: "4A443B" });
  });
  s.addNotes("About 60% of images are Ripe, so training uses a balanced sampler. The three test sets answer three different questions. Every third Fruits-360 frame is kept, because neighbouring frames are near-duplicates.");
}

// ── 6 · method ──────────────────────────────────────────────────────────────
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "One backbone, two heads", "Method");
  const box = (x, y, w, h, text, fill, line) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: line, width: 1.25 } });
    T(s, text, { x, y, w, h, align: "center", valign: "middle", fontSize: 16, fontFace: "Cambria" });
  };
  const arrow = (x1, y1, x2, y2, color = INK) => s.addShape(pres.shapes.LINE, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color, width: 1.5, endArrowType: "triangle" }, flipV: y2 < y1 });
  box(MX, 2.6, 1.6, 1.0, "Photo\n112 × 112", "F5DED7", INK);
  arrow(MX + 1.6, 3.1, MX + 2.1, 3.1);
  box(MX + 2.1, 2.4, 2.2, 1.4, "ResNet-18\nImageNet-pretrained", "EFE3D6", INK);
  arrow(MX + 4.3, 3.1, MX + 4.8, 3.1);
  box(MX + 4.8, 2.7, 1.3, 0.8, "512-d", "FFFFFF", INK);
  arrow(MX + 6.1, 3.1, MX + 6.7, 2.25, CE);
  arrow(MX + 6.1, 3.1, MX + 6.7, 3.95, CORAL);
  box(MX + 6.7, 1.85, 2.3, 0.8, "CE head  512 → 4", "E3EEF7", CE);
  box(MX + 6.7, 3.55, 2.3, 0.8, "CORAL head  512 → 1 + 3 biases", "F6E3DA", CORAL);
  T(s, "softmax → argmax", { x: MX + 9.2, y: 1.85, w: 2.8, h: 0.8, fontSize: 14, color: MUTED, valign: "middle" });
  T(s, "σ(w·x + b_k) → count “yes”", { x: MX + 9.2, y: 3.55, w: 2.8, h: 0.8, fontSize: 14, color: MUTED, valign: "middle" });
  card(s, MX, 4.8, W - 2 * MX, 1.85);
  T(s, bullets([
    "Everything except the last layer and the loss is shared: weights, splits, augmentations, sampler order, optimiser, schedule, seeds.",
    "Augmentation: random crop, flips, ±20° rotation, brightness/contrast — but no hue jitter: colour is the ripeness cue, and shifting hue would turn a green tomato red while keeping the label “Unripe”.",
  ]), { x: MX + 0.3, y: 5.0, w: W - 2 * MX - 0.6, h: 1.5, fontSize: 15 });
  s.addNotes("Both models share the same ResNet-18. The only difference is the final layer and its loss. This isolates the effect of treating the problem as ordinal.");
}

// ── 7 · CORAL ───────────────────────────────────────────────────────────────
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "CORAL: three ordered yes/no questions", "Method");
  T(s, bullets([
    "Ask K − 1 = 3 binary questions: is the grade > 0? > 1? > 2?",
    "All three share one weight vector w and differ only by a bias b_k:  P(y > k) = σ(w·x + b_k).",
    "Loss = sum of the three binary cross-entropies, so a far-off prediction gets several questions wrong.",
    "Prediction = number of questions answered “yes” (P > 0.5).",
    "Shared w keeps the answers rank-consistent: P(y>0) ≥ P(y>1) ≥ P(y>2).",
  ]), { x: MX, y: 1.75, w: 6.3, h: 4.8, fontSize: 17 });
  const rows = [[{ text: "Grade", options: { bold: true } }, { text: "> 0 ?", options: { bold: true, align: "center" } }, { text: "> 1 ?", options: { bold: true, align: "center" } }, { text: "> 2 ?", options: { bold: true, align: "center" } }]];
  GRADES.forEach((g, i) => rows.push([{ text: `${i} · ${g}`, options: { color: GRADE[i], bold: true } }, ...[0, 1, 2].map(k => ({ text: i > k ? "1" : "0", options: { align: "center", fill: { color: i > k ? "F6E3DA" : "FFFFFF" } } }))]));
  T(s, "Labels become “levels”", { x: 7.4, y: 1.75, w: 5.2, h: 0.4, fontSize: 17, fontFace: "Cambria", color: CORAL });
  s.addTable(rows, { x: 7.4, y: 2.25, w: 5.3, colW: [2.0, 1.1, 1.1, 1.1], fontSize: 15, fontFace: "Calibri", color: INK, border: { type: "solid", color: "E2D8C4", pt: 0.75 }, rowH: 0.48 });
  card(s, 7.4, 4.95, 5.3, 1.55);
  T(s, "Truth Turning [1,0,0] vs prediction Overripe [1,1,1]: two of three questions wrong. Prediction Ripe [1,1,0]: only one wrong. The loss grows with distance.", { x: 7.6, y: 5.1, w: 4.9, h: 1.3, fontSize: 14, color: "4A443B", valign: "middle" });
  s.addNotes("CORAL is from Cao, Mirjalili and Raschka (2020). Walk through the levels table. Emphasise the shared weight vector and why it gives rank consistency.");
}

// ── 8 · setup ───────────────────────────────────────────────────────────────
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "A like-for-like experiment", "Implementation");
  const rows = [
    ["Backbone", "ResNet-18, ImageNet weights, all layers fine-tuned"],
    ["Input", "112 × 112 RGB, ImageNet normalisation"],
    ["Optimiser", "AdamW, lr 3·10⁻⁴ (head 10×), weight decay 10⁻⁴, cosine"],
    ["Training", "8 epochs, batch 32, grade-balanced sampler, CPU"],
    ["Model selection", "Checkpoint with lowest validation MAE (both heads)"],
    ["Seeds", `${res.seeds.join(", ")} — results reported as mean ± std`],
    ["Metrics", "Accuracy, MAE, within-one, severe-error rate (≥ 2 off), QWK, macro-F1"],
    ["Tools", "PyTorch, torchvision, scikit-learn, Flask, ONNX Runtime (web)"],
  ].map(([a, b]) => [{ text: a, options: { bold: true, color: EARTH } }, { text: b }]);
  s.addTable(rows, { x: MX, y: 1.8, w: 8.0, colW: [2.2, 5.8], fontSize: 15, fontFace: "Calibri", color: INK, border: { type: "solid", color: "E2D8C4", pt: 0.75 }, rowH: 0.52, fill: { color: "FFFFFF" } });
  card(s, 9.0, 1.8, 3.7, 4.2, PAPER2);
  T(s, "Only the head differs", { x: 9.25, y: 2.0, w: 3.2, h: 0.5, fontSize: 19, fontFace: "Cambria" });
  T(s, "Same images, same augmentation, same sampler order, same optimiser and schedule, same seeds. Any difference in the results comes from the head and its loss.", { x: 9.25, y: 2.6, w: 3.2, h: 3.2, fontSize: 15, color: "4A443B" });
  T(s, "Lesson learned: with one learning rate and thresholds initialised 1/3 apart, CORAL first stalled (val MAE ≈ 0.75). A 10× head learning rate for both heads and thresholds initialised at the class prior fixed it.", { x: MX, y: 6.15, w: 8.0, h: 0.7, fontSize: 13, color: MUTED, italic: true });
  s.addNotes("This is what makes the comparison fair. Mention the three seeds: results vary with random initialisation, so we report mean and standard deviation. Mention the lesson learned: CORAL's thresholds need room and a faster learning rate to separate the middle grades.");
}

// ── 9 · headline ────────────────────────────────────────────────────────────
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  const dMae = (P.ce.mae - P.coral.mae) / P.ce.mae;
  title(s, dMae > 0 ? `CORAL cuts the mean error by ${(dMae * 100).toFixed(0)}%` : `Cross-entropy keeps the lower mean error`, `Results · all ${P.ce.n.toLocaleString()} test images pooled, seed 42`);
  const stat = (x, label, ce, co) => {
    card(s, x, 1.9, 3.85, 3.6);
    T(s, label, { x: x + 0.3, y: 2.05, w: 3.3, h: 0.45, fontSize: 16, color: MUTED });
    T(s, ce, { x: x + 0.3, y: 2.55, w: 3.3, h: 1.0, fontSize: 48, color: CE, fontFace: "Cambria" });
    T(s, "cross-entropy", { x: x + 0.3, y: 3.5, w: 3.3, h: 0.3, fontSize: 12, color: MUTED, italic: true });
    T(s, co, { x: x + 0.3, y: 3.9, w: 3.3, h: 1.0, fontSize: 48, color: CORAL, fontFace: "Cambria" });
    T(s, "CORAL ordinal", { x: x + 0.3, y: 4.85, w: 3.3, h: 0.3, fontSize: 12, color: MUTED, italic: true });
  };
  stat(MX, "MAE (grades, lower is better)", f3(P.ce.mae), f3(P.coral.mae));
  stat(MX + 4.1, "Exact accuracy", pct(P.ce.accuracy), pct(P.coral.accuracy));
  stat(MX + 8.2, "Severe errors (≥ 2 grades off)", pct(P.ce.severe_error_rate), pct(P.coral.severe_error_rate));
  T(s, `Quadratic weighted kappa: ${f3(P.ce.qwk)} (CE) vs ${f3(P.coral.qwk)} (CORAL).  Per-test-set means over ${nSeeds} seed${nSeeds > 1 ? "s" : ""} on the next slide.`, { x: MX, y: 5.85, w: W - 2 * MX, h: 0.5, fontSize: 15, color: "4A443B" });
  s.addNotes("Headline numbers on all test images together. MAE is the main ordinal metric; severe errors are the costly ones.");
}

// ── 10 · per test set ───────────────────────────────────────────────────────
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Per test set", `Results · mean over ${nSeeds} seed${nSeeds > 1 ? "s" : ""}`);
  const labels = SPLITS.map(k => res.splits[k]);
  const series = m => [{ name: "Cross-entropy", labels, values: SPLITS.map(k => M.ce[k][m]) }, { name: "CORAL ordinal", labels, values: SPLITS.map(k => M.coral[k][m]) }];
  const common = { barDir: "col", barGrouping: "clustered", chartColors: [CE, CORAL], barGapWidthPct: 70, showValue: true, dataLabelPosition: "outEnd", showLegend: true, legendPos: "b", showTitle: true, ...chartText };
  s.addChart(pres.charts.BAR, series("accuracy"), { x: MX, y: 1.7, w: 6.0, h: 4.6, title: "Accuracy (higher is better)", valAxisMinVal: 0, valAxisMaxVal: 1, dataLabelFormatCode: "0.00", valAxisLabelFormatCode: "0%", ...common });
  s.addChart(pres.charts.BAR, series("mae"), { x: MX + 6.2, y: 1.7, w: 6.0, h: 4.6, title: "MAE in grades (lower is better)", valAxisMinVal: 0, dataLabelFormatCode: "0.000", valAxisLabelFormatCode: "0.00", ...common });
  const sd = SPLITS.map(k => `${res.splits[k]}: MAE ±${S.ce[k].mae.toFixed(3)} / ±${S.coral[k].mae.toFixed(3)}`).join("   ·   ");
  T(s, nSeeds > 1 ? `Std across seeds (CE / CORAL) — ${sd}` : "Single seed so far — re-run with all seeds for error bars.", { x: MX, y: 6.45, w: W - 2 * MX, h: 0.4, fontSize: 11, color: MUTED, italic: true });
  s.addNotes("Seen varieties are easy for both models. The interesting sets are unseen varieties and real-world photos, where the models must generalise.");
}

// ── 11 · confusion ──────────────────────────────────────────────────────────
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Where the errors land", "Confusion matrices · all test images, seed 42");
  const table = (x, m, color, name) => {
    T(s, name, { x, y: 1.75, w: 5.6, h: 0.4, fontSize: 18, fontFace: "Cambria", color });
    const rows = [[{ text: "true \\ predicted", options: { italic: true, color: MUTED } }, ...GRADES.map(g => ({ text: g, options: { italic: true, color: MUTED, align: "center" } }))]];
    m.forEach((row, i) => {
      const tot = row.reduce((a, b) => a + b, 0) || 1;
      rows.push([{ text: GRADES[i], options: { color: MUTED } }, ...row.map((n, j) => {
        const f = n / tot, light = ["FFFFFF", "F3F7FB", "D6E5F2", "A9C8E3", "5E97C6"], warm = ["FFFFFF", "FBF1EC", "F0D3C4", "E0A98C", "C46E46"];
        const shade = (color === CE ? light : warm)[Math.min(4, Math.ceil(f * 4))];
        return { text: String(n), options: { align: "center", bold: i === j, color: f > 0.7 ? "FFFFFF" : INK, fill: { color: shade } } };
      })]);
    });
    s.addTable(rows, { x, y: 2.25, w: 5.6, colW: [1.6, 1.0, 1.0, 1.0, 1.0], fontSize: 14, fontFace: "Calibri", color: INK, border: { type: "solid", color: "E2D8C4", pt: 0.75 }, rowH: 0.55 });
  };
  table(MX, res.confusion_seed42.ce, CE, "Cross-entropy");
  table(MX + 6.3, res.confusion_seed42.coral, CORAL, "CORAL ordinal");
  const far = m => m.reduce((a, row, i) => a + row.reduce((b, n, j) => b + (Math.abs(i - j) >= 2 ? n : 0), 0), 0);
  T(s, `Rows are true grades; the bold diagonal is “exactly right”. Errors two or more grades off: ${far(res.confusion_seed42.ce)} (CE) vs ${far(res.confusion_seed42.coral)} (CORAL).`, { x: MX, y: 5.35, w: W - 2 * MX, h: 0.7, fontSize: 15, color: "4A443B" });
  s.addNotes("Read along a row. Errors next to the diagonal are cheap, errors in the corners are costly. Banana has no Unripe examples, which is why the Unripe row only contains tomatoes.");
}

// ── 12 · error distance + curves ────────────────────────────────────────────
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "How far off, and how training went", "Results");
  const dist = m => [0, 1, 2, 3].map(d => m.reduce((a, row, i) => a + row.reduce((b, n, j) => b + (Math.abs(i - j) === d ? n : 0), 0), 0));
  const N = dist(res.confusion_seed42.ce).reduce((a, b) => a + b, 0);
  const labels = ["exact", "off by 1", "off by 2", "off by 3"];
  s.addChart(pres.charts.BAR, [
    { name: "Cross-entropy", labels, values: dist(res.confusion_seed42.ce).map(v => v / N) },
    { name: "CORAL ordinal", labels, values: dist(res.confusion_seed42.coral).map(v => v / N) },
  ], { x: MX, y: 1.7, w: 5.6, h: 4.9, barDir: "col", barGrouping: "clustered", chartColors: [CE, CORAL], showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0%", valAxisLabelFormatCode: "0%", valAxisMinVal: 0, showLegend: true, legendPos: "b", showTitle: true, title: "Share of test images by error distance (seed 42)", ...chartText });
  img(s, "training_curves.png", MX + 5.9, 1.9, 6.3, 2.3);
  T(s, "Validation MAE and accuracy per epoch. Bold = seed 42, faint = other seeds. The checkpoint with the lowest validation MAE is kept for both heads.", { x: MX + 5.9, y: 4.4, w: 6.3, h: 0.9, fontSize: 14, color: "4A443B" });
  s.addNotes("The error-distance chart is the clearest view of the ordinal effect: how many predictions are off by two or more grades.");
}

// ── 13 · demo ───────────────────────────────────────────────────────────────
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Demo: the grading sketchbook", "Implementation");
  const shot = path.join(SHOTS, "bench.png");
  if (fs.existsSync(shot)) s.addImage({ path: shot, x: MX, y: 1.7, w: 7.5, h: 5.0, sizing: { type: "contain", w: 7.5, h: 5.0 } });
  T(s, bullets([
    "Nine-plate sketchbook: page turns, magnifying glass, zoom, keyboard navigation.",
    "Plate V grades an uploaded photo with both models side by side and shows a 0–3 ripeness score.",
    "Plate IX saves labelled photos into the self-collected subset.",
    "Hosted on Cloudflare Pages: models exported to 8-bit ONNX (~11 MB each) and run in the browser — no server.",
  ]), { x: 8.4, y: 1.8, w: 4.3, h: 4.0, fontSize: 15 });
  if (SITE_URL) T(s, SITE_URL, { x: 8.4, y: 5.95, w: 4.3, h: 0.5, fontSize: 15, color: EARTH, hyperlink: { url: SITE_URL } });
  s.addNotes("Switch to the live demo here. Upload a banana photo, show both predictions and the ripeness score, then use the magnifying glass.");
}

// ── 14 · discussion ─────────────────────────────────────────────────────────
{
  const s = pres.addSlide({ masterName: "CONTENT" });
  title(s, "Discussion", "What we learned");
  const real = res.splits.test_real ? [M.ce.test_real.mae, M.coral.test_real.mae] : null;
  const unseen = [M.ce.test_unseen.mae, M.coral.test_unseen.mae];
  const cols = [
    ["Findings", [
      `Pooled MAE ${f3(P.ce.mae)} (CE) vs ${f3(P.coral.mae)} (CORAL); severe errors ${pct(P.ce.severe_error_rate)} vs ${pct(P.coral.severe_error_rate)}.`,
      `Unseen cultivars: MAE ${f3(unseen[0])} vs ${f3(unseen[1])}.` + (real ? ` Real-world bananas: ${f3(real[0])} vs ${f3(real[1])}.` : ""),
      "Seen-variety test frames are near-perfect for both — they come from the same physical fruits as training.",
      "The ordinal head adds no inference cost: one linear layer either way.",
    ]],
    ["Limitations", [
      "Grades come from folder and caption rules, not from sugar or firmness measurements.",
      "Few physical fruits per Fruits-360 folder; studio backgrounds.",
      "No fully green bananas in public data — relies on self-collection.",
      "CPU budget: 8 epochs, one backbone, three seeds.",
    ]],
  ];
  cols.forEach(([h, items], i) => {
    const x = MX + i * 6.15;
    card(s, x, 1.8, 5.9, 4.8, i === 0 ? "FFFFFF" : PAPER2);
    T(s, h, { x: x + 0.3, y: 1.95, w: 5.3, h: 0.5, fontSize: 20, fontFace: "Cambria", color: i === 0 ? EARTH : INK });
    T(s, bullets(items), { x: x + 0.3, y: 2.55, w: 5.3, h: 3.9, fontSize: 15 });
  });
  s.addNotes("Be honest about the limitations; the examiners will ask about label quality and the near-duplicate frames.");
}

// ── 15 · conclusion ─────────────────────────────────────────────────────────
{
  const s = pres.addSlide({ masterName: "DARK" });
  T(s, "Conclusion", { x: MX, y: 0.7, w: 10, h: 0.9, fontSize: 40, color: PAPER, fontFace: "Cambria" });
  T(s, bullets([
    "Ripeness is an ordered scale; treating it as one changes where the mistakes go.",
    `With the same backbone and data, CORAL moved pooled MAE from ${f3(P.ce.mae)} to ${f3(P.coral.mae)} and severe errors from ${pct(P.ce.severe_error_rate)} to ${pct(P.coral.severe_error_rate)}.`,
    "A working, hosted demo grades photos in the browser with both models.",
  ], { color: "E8DFCC" }), { x: MX, y: 1.8, w: 7.4, h: 3.6, fontSize: 18, color: "E8DFCC" });
  T(s, "Next steps", { x: 8.6, y: 1.8, w: 4.2, h: 0.5, fontSize: 20, color: "D8B48C", fontFace: "Cambria" });
  T(s, bullets([
    "Collect 50+ photos per fruit and grade under real lighting",
    "Try CORN and cost-sensitive ordinal losses",
    "Calibrate the score to days-until-ripe",
    "Grad-CAM to check the model looks at the peel",
  ], { color: "E8DFCC" }), { x: 8.6, y: 2.4, w: 4.2, h: 3.4, fontSize: 15, color: "E8DFCC" });
  T(s, "Thank you · Questions?", { x: MX, y: 6.3, w: 8, h: 0.6, fontSize: 22, color: PAPER, italic: true, fontFace: "Cambria" });
  s.addNotes("Summarise in one sentence: same model, ordinal loss, fewer far-off mistakes. Then take questions.");
}

pres.writeFile({ fileName: path.join(ROOT, "docs", "Presentation.pptx") }).then(f => console.log("wrote", f));
