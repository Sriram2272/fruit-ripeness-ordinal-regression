"""Exports the seed-42 CE and CORAL models to ONNX for in-browser inference.

Cloudflare Pages serves files up to 25 MiB, and a float32 ResNet-18 is ~45 MB, so the
weights are quantised to 8 bits (~11 MB). The script then checks that the quantised model
gives the same grades as PyTorch on every test image, and reports the metrics of both.

    python src/export_onnx.py [--out site/models]
"""
import argparse
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch
from onnxruntime.quantization import QuantType, quantize_dynamic

from config import IMAGE_SIZE, OUTPUTS, ROOT
from dataset import RipenessDataset, eval_tf, load_manifest
from metrics import compute_metrics
from predict import load_model


def run(path, x):
    sess = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    return np.concatenate([sess.run(None, {"image": x[i:i + 256]})[0] for i in range(0, len(x), 256)])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(ROOT / "site" / "models"))
    args = ap.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    tmp = OUTPUTS / "onnx_fp32"
    tmp.mkdir(parents=True, exist_ok=True)

    df = load_manifest()
    test = RipenessDataset(df[df.split.str.startswith("test")], eval_tf)
    x = torch.stack([test[i][0] for i in range(len(test))])
    y = test.df.grade.to_numpy()

    for head in ("ce", "coral"):
        model = load_model(head)
        fp32 = tmp / f"{head}.onnx"
        torch.onnx.export(model, torch.randn(1, 3, IMAGE_SIZE, IMAGE_SIZE), str(fp32),
                          input_names=["image"], output_names=["logits"],
                          dynamic_axes={"image": {0: "n"}, "logits": {0: "n"}}, opset_version=17, dynamo=False)
        int8 = out / f"{head}.onnx"
        # Only the convolutions (>99% of the weights) are quantised. The heads stay float: the
        # quantiser would otherwise fuse CORAL's 1-output MatMul with its 3 threshold biases
        # into a DynamicQuantizeMatMul node, which cannot broadcast them.
        quantize_dynamic(str(fp32), str(int8), weight_type=QuantType.QUInt8, op_types_to_quantize=["Conv"])

        with torch.no_grad():
            p_torch = model.predict(model(x))[0].numpy()
        p_int8 = model.predict(torch.from_numpy(run(int8, x.numpy())))[0].numpy()
        m_t, m_q = compute_metrics(y, p_torch), compute_metrics(y, p_int8)
        print(f"{head}: {int8.stat().st_size / 1e6:.1f} MB int8 (fp32 {fp32.stat().st_size / 1e6:.1f} MB) | "
              f"same grade as PyTorch on {(p_torch == p_int8).mean():.2%} of {len(y)} test images | "
              f"acc {m_t['accuracy']:.3f}->{m_q['accuracy']:.3f}  MAE {m_t['mae']:.3f}->{m_q['mae']:.3f}")


if __name__ == "__main__":
    main()
