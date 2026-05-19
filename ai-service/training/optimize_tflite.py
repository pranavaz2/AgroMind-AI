"""Export optimized TensorFlow Lite artifacts for AgroMind AI.

Run from ai-service:
  python -m training.optimize_tflite --model-path models/leaf_disease_model.keras

For full integer quantization with calibration images:
  python -m training.optimize_tflite --model-path models/leaf_disease_model.keras --representative-data-dir data/processed/plantvillage/train --quantization int8
"""

from __future__ import annotations

import argparse
import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps


SUPPORTED_IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


@dataclass(frozen=True)
class OptimizationConfig:
    model_path: Path
    output_dir: Path
    image_size: int
    quantization: str
    representative_data_dir: Path | None
    representative_sample_count: int
    benchmark_runs: int


def parse_args() -> OptimizationConfig:
    parser = argparse.ArgumentParser(
        description="Convert a trained AgroMind Keras model to optimized TensorFlow Lite."
    )
    parser.add_argument("--model-path", type=Path, default=Path("models/leaf_disease_model.keras"))
    parser.add_argument("--output-dir", type=Path, default=Path("models/optimized"))
    parser.add_argument("--image-size", type=int, default=224)
    parser.add_argument(
        "--quantization",
        choices=["dynamic", "float16", "int8", "all"],
        default="all",
        help="Optimization format to export.",
    )
    parser.add_argument(
        "--representative-data-dir",
        type=Path,
        default=None,
        help="Folder of calibration images for full int8 quantization.",
    )
    parser.add_argument("--representative-sample-count", type=int, default=100)
    parser.add_argument("--benchmark-runs", type=int, default=25)
    args = parser.parse_args()

    return OptimizationConfig(
        model_path=args.model_path,
        output_dir=args.output_dir,
        image_size=args.image_size,
        quantization=args.quantization,
        representative_data_dir=args.representative_data_dir,
        representative_sample_count=args.representative_sample_count,
        benchmark_runs=args.benchmark_runs,
    )


def load_image_for_model(path: Path, image_size: int) -> np.ndarray:
    image = Image.open(path)
    image.load()
    image = ImageOps.exif_transpose(image).convert("RGB")
    image = ImageOps.fit(
        image,
        (image_size, image_size),
        method=Image.Resampling.BILINEAR,
        centering=(0.5, 0.5),
    )
    return np.asarray(image, dtype=np.float32) / 255.0


def iter_image_paths(data_dir: Path, limit: int) -> list[Path]:
    paths = [
        path
        for path in data_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in SUPPORTED_IMAGE_SUFFIXES
    ]
    return sorted(paths)[:limit]


def make_representative_dataset(data_dir: Path, image_size: int, sample_count: int):
    paths = iter_image_paths(data_dir, sample_count)
    if not paths:
        raise ValueError(f"No calibration images found in {data_dir}")

    def representative_dataset():
        for path in paths:
            image = load_image_for_model(path, image_size)
            yield [np.expand_dims(image, axis=0).astype(np.float32)]

    return representative_dataset, len(paths)


def write_tflite(path: Path, payload: bytes) -> dict:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return {
        "path": str(path),
        "bytes": path.stat().st_size,
        "megabytes": round(path.stat().st_size / (1024 * 1024), 3),
    }


def convert_dynamic(tf, model, output_dir: Path) -> dict:
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    payload = converter.convert()
    return write_tflite(output_dir / "leaf_disease_dynamic.tflite", payload)


def convert_float16(tf, model, output_dir: Path) -> dict:
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.float16]
    payload = converter.convert()
    return write_tflite(output_dir / "leaf_disease_float16.tflite", payload)


def convert_int8(tf, model, output_dir: Path, representative_dataset) -> dict:
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = representative_dataset
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.uint8
    converter.inference_output_type = tf.uint8
    payload = converter.convert()
    return write_tflite(output_dir / "leaf_disease_int8.tflite", payload)


def make_benchmark_input(input_details: dict) -> np.ndarray:
    shape = input_details["shape"]
    dtype = input_details["dtype"]

    if np.issubdtype(dtype, np.integer):
        return np.random.randint(0, 255, size=shape, dtype=dtype)

    return np.random.random(size=shape).astype(dtype)


def benchmark_tflite(tf, model_path: Path, runs: int) -> dict:
    interpreter = tf.lite.Interpreter(model_path=str(model_path))
    interpreter.allocate_tensors()
    input_details = interpreter.get_input_details()[0]
    output_details = interpreter.get_output_details()[0]
    sample = make_benchmark_input(input_details)

    interpreter.set_tensor(input_details["index"], sample)
    interpreter.invoke()

    timings_ms = []
    for _ in range(runs):
        interpreter.set_tensor(input_details["index"], sample)
        started = time.perf_counter()
        interpreter.invoke()
        timings_ms.append((time.perf_counter() - started) * 1000)

    return {
        "runs": runs,
        "mean_ms": round(float(np.mean(timings_ms)), 3),
        "p95_ms": round(float(np.percentile(timings_ms, 95)), 3),
        "input_dtype": str(input_details["dtype"]),
        "output_dtype": str(output_details["dtype"]),
        "input_shape": input_details["shape"].astype(int).tolist(),
    }


def main() -> None:
    config = parse_args()
    if not config.model_path.exists():
        raise FileNotFoundError(f"Model not found: {config.model_path}")

    import tensorflow as tf

    config.output_dir.mkdir(parents=True, exist_ok=True)
    model = tf.keras.models.load_model(config.model_path, compile=False)

    keras_size = config.model_path.stat().st_size
    artifacts: dict[str, dict] = {}
    representative_count = 0

    requested = (
        ["dynamic", "float16", "int8"]
        if config.quantization == "all"
        else [config.quantization]
    )

    if "dynamic" in requested:
        artifacts["dynamic"] = convert_dynamic(tf, model, config.output_dir)

    if "float16" in requested:
        artifacts["float16"] = convert_float16(tf, model, config.output_dir)

    representative_dataset = None
    if "int8" in requested:
        if not config.representative_data_dir:
            print("Skipping int8 export: --representative-data-dir is required for calibration.")
        else:
            representative_dataset, representative_count = make_representative_dataset(
                config.representative_data_dir,
                config.image_size,
                config.representative_sample_count,
            )
            artifacts["int8"] = convert_int8(
                tf,
                model,
                config.output_dir,
                representative_dataset,
            )

    benchmarks = {}
    for name, artifact in artifacts.items():
        benchmarks[name] = benchmark_tflite(
            tf,
            Path(artifact["path"]),
            config.benchmark_runs,
        )

    report = {
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "tensorflow_version": tf.__version__,
        "config": {
            **asdict(config),
            "model_path": str(config.model_path),
            "output_dir": str(config.output_dir),
            "representative_data_dir": str(config.representative_data_dir)
            if config.representative_data_dir
            else None,
        },
        "source_model": {
            "path": str(config.model_path),
            "bytes": keras_size,
            "megabytes": round(keras_size / (1024 * 1024), 3),
        },
        "representative_sample_count": representative_count,
        "artifacts": artifacts,
        "benchmarks": benchmarks,
        "recommendation": (
            "Use float16 for GPU/mobile accelerators when supported. "
            "Use int8 for smallest CPU/mobile deployment after validating accuracy. "
            "Use dynamic range as the safest general-purpose compression baseline."
        ),
    }

    report_path = config.output_dir / "optimization_report.json"
    with report_path.open("w", encoding="utf-8") as file:
        json.dump(report, file, indent=2)

    print("\nOptimization complete.")
    print(f"Source model: {config.model_path} ({report['source_model']['megabytes']} MB)")
    for name, artifact in artifacts.items():
        benchmark = benchmarks.get(name, {})
        print(
            f"{name}: {artifact['path']} ({artifact['megabytes']} MB, "
            f"mean {benchmark.get('mean_ms', 'n/a')} ms)"
        )
    print(f"Report: {report_path}")


if __name__ == "__main__":
    main()
