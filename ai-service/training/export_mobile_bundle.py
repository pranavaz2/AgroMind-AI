"""Package a TFLite model for React Native mobile deployment.

Run from ai-service:
  python -m training.export_mobile_bundle

Custom variant:
  python -m training.export_mobile_bundle --variant int8 --model-dir models/_smoke

This creates a ready-to-copy bundle at:
  models/mobile_bundle/
    leaf_disease.tflite
    class_names.json
    mobile_model_manifest.json
"""

from __future__ import annotations

import argparse
import json
import shutil
import time
from pathlib import Path


VARIANT_FILENAMES = {
    "dynamic": "leaf_disease_dynamic.tflite",
    "float16": "leaf_disease_float16.tflite",
    "int8": "leaf_disease_int8.tflite",
}

DEFAULT_VARIANT = "float16"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Package a TFLite model for React Native mobile deployment."
    )
    parser.add_argument(
        "--model-dir",
        type=Path,
        default=Path("models"),
        help="Root model directory containing the optimized/ subfolder and class_names.json.",
    )
    parser.add_argument(
        "--variant",
        choices=list(VARIANT_FILENAMES.keys()),
        default=DEFAULT_VARIANT,
        help=f"TFLite quantization variant to bundle (default: {DEFAULT_VARIANT}).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Output directory for the mobile bundle (default: <model-dir>/mobile_bundle).",
    )
    return parser.parse_args()


def read_json(path: Path) -> dict | list:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, data: dict | list) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def main() -> None:
    args = parse_args()

    model_dir: Path = args.model_dir
    variant: str = args.variant
    output_dir: Path = args.output_dir or model_dir / "mobile_bundle"

    # ── Locate source files ──────────────────────────────────────────
    tflite_filename = VARIANT_FILENAMES[variant]
    tflite_source = model_dir / "optimized" / tflite_filename
    class_names_source = model_dir / "class_names.json"
    metadata_source = model_dir / "model_metadata.json"
    optimization_report = model_dir / "optimized" / "optimization_report.json"

    if not tflite_source.exists():
        raise FileNotFoundError(
            f"TFLite model not found: {tflite_source}\n"
            f"Run optimize_tflite.py first to generate optimized models."
        )
    if not class_names_source.exists():
        raise FileNotFoundError(
            f"Class names not found: {class_names_source}\n"
            f"Run train_mobilenetv2.py first to generate class_names.json."
        )

    # ── Create output bundle ─────────────────────────────────────────
    output_dir.mkdir(parents=True, exist_ok=True)

    # Copy TFLite model with a generic name
    dest_tflite = output_dir / "leaf_disease.tflite"
    shutil.copy2(tflite_source, dest_tflite)

    # Copy class names
    dest_class_names = output_dir / "class_names.json"
    shutil.copy2(class_names_source, dest_class_names)

    # ── Build manifest ───────────────────────────────────────────────
    class_names = read_json(class_names_source)
    tflite_size = dest_tflite.stat().st_size

    manifest = {
        "model_version": "1.0.0",
        "model_file": "leaf_disease.tflite",
        "quantization": variant,
        "input": {
            "shape": [1, 224, 224, 3],
            "dtype": "float32" if variant != "int8" else "uint8",
            "image_size": 224,
            "value_range": [0, 1] if variant != "int8" else [0, 255],
        },
        "output": {
            "activation": "softmax",
            "class_count": len(class_names),
        },
        "class_names_file": "class_names.json",
        "tflite_size_bytes": tflite_size,
        "tflite_size_mb": round(tflite_size / (1024 * 1024), 3),
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }

    # Enrich with source model metadata if available
    if metadata_source.exists():
        source_meta = read_json(metadata_source)
        if isinstance(source_meta, dict):
            manifest["source_model"] = {
                "format": source_meta.get("model_format", "keras"),
                "tensorflow_version": source_meta.get("tensorflow_version"),
                "image_size": source_meta.get("input", {}).get("image_size", 224),
            }

    # Include benchmark data if available
    if optimization_report.exists():
        report = read_json(optimization_report)
        if isinstance(report, dict):
            benchmarks = report.get("benchmarks", {})
            if variant in benchmarks:
                manifest["benchmark"] = benchmarks[variant]
            manifest["source_model_size_mb"] = (
                report.get("source_model", {}).get("megabytes")
            )

    dest_manifest = output_dir / "mobile_model_manifest.json"
    write_json(dest_manifest, manifest)

    # ── Summary ──────────────────────────────────────────────────────
    print("\nMobile bundle created successfully.")
    print(f"  Output:      {output_dir}")
    print(f"  Variant:     {variant}")
    print(f"  Model:       {dest_tflite.name} ({manifest['tflite_size_mb']} MB)")
    print(f"  Classes:     {len(class_names)}")
    print(f"  Manifest:    {dest_manifest.name}")
    print(f"\nCopy this folder to your React Native project:")
    print(f"  cp -r {output_dir} mobile/assets/model")


if __name__ == "__main__":
    main()
