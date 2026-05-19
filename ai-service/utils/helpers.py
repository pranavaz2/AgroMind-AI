"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  AgroMind AI — Helper Utilities                                            ║
║                                                                            ║
║  Small, pure-Python functions used by multiple pipeline stages.            ║
║  Keeping them here avoids circular imports and makes unit-testing easy.    ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

from __future__ import annotations

import json
import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple


# ══════════════════════════════════════════════════════════════════════════════
#  CLASS WEIGHTS — Fighting Imbalanced Datasets
# ══════════════════════════════════════════════════════════════════════════════
#
#  📖 BEGINNER GUIDE — CLASS IMBALANCE
#  ────────────────────────────────────
#  Our dataset is *imbalanced*:
#      Tomato_Late_blight  →  1 909 images
#      Potato___healthy    →    152 images  (12× fewer!)
#
#  Without correction the model would learn to just predict the majority
#  class (it scores 33 % accuracy for free!) while ignoring rare classes.
#
#  Class weights tell the loss function "this class is rare — penalise
#  mistakes on it MORE".  The formula is:
#
#      weight(class_i) = total_samples / (num_classes × class_i_samples)
#
#  So a class with 152 images gets ~7.4× the penalty of one with 1 909.
# ══════════════════════════════════════════════════════════════════════════════

def compute_class_weights(
    class_counts: Dict[str, int],
    class_names: List[str],
) -> Dict[int, float]:
    """Return a dict mapping class-index → weight for use in model.fit().

    Args:
        class_counts: {class_name: image_count} for the *training* split.
        class_names:  ordered list that matches the model's output neurons.

    Returns:
        {0: w0, 1: w1, …} ready for the ``class_weight`` argument.
    """
    total = sum(class_counts.values())
    n_classes = len(class_names)

    if total == 0 or n_classes == 0:
        return {}

    weights: Dict[int, float] = {}
    for idx, name in enumerate(class_names):
        count = max(class_counts.get(name, 1), 1)  # avoid division by zero
        weights[idx] = total / (n_classes * count)

    return weights


def count_images_per_class(data_dir: Path, class_names: List[str]) -> Dict[str, int]:
    """Walk the train/ folder and count images per sub-folder."""
    counts: Dict[str, int] = {}
    train_dir = data_dir / "train"
    for name in class_names:
        class_dir = train_dir / name
        if class_dir.exists():
            counts[name] = sum(1 for p in class_dir.rglob("*") if p.is_file())
        else:
            counts[name] = 0
    return counts


# ══════════════════════════════════════════════════════════════════════════════
#  DISPLAY NAME HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def clean_class_name(raw_name: str) -> str:
    """Convert folder names into human-readable labels.

    Examples:
        Tomato___Early_blight  →  Tomato - Early blight
        Tomato_healthy         →  Tomato healthy
        Potato___healthy       →  Potato - healthy
    """
    if "___" in raw_name:
        crop, disease = raw_name.split("___", maxsplit=1)
        return f"{crop.replace('_', ' ')} - {disease.replace('_', ' ')}"
    return raw_name.replace("_", " ")


# ══════════════════════════════════════════════════════════════════════════════
#  METRICS & EVALUATION REPORT
# ══════════════════════════════════════════════════════════════════════════════

def build_confusion_matrix(
    y_true: List[int],
    y_pred: List[int],
    num_classes: int,
) -> List[List[int]]:
    """Pure-Python confusion matrix (no sklearn dependency)."""
    matrix = [[0] * num_classes for _ in range(num_classes)]
    for t, p in zip(y_true, y_pred):
        matrix[t][p] += 1
    return matrix


def build_classification_report(
    confusion: List[List[int]],
    class_names: List[str],
) -> Dict:
    """Compute per-class precision / recall / F1 and macro/weighted averages."""
    per_class = []
    total_support = 0
    w_prec = w_rec = w_f1 = 0.0

    for i, name in enumerate(class_names):
        tp = confusion[i][i]
        fp = sum(row[i] for row in confusion) - tp
        fn = sum(confusion[i]) - tp
        support = sum(confusion[i])

        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0

        per_class.append({
            "class": name, "precision": precision,
            "recall": recall, "f1": f1, "support": support,
        })
        total_support += support
        w_prec += precision * support
        w_rec += recall * support
        w_f1 += f1 * support

    n = max(len(class_names), 1)
    return {
        "per_class": per_class,
        "macro": {
            "precision": sum(c["precision"] for c in per_class) / n,
            "recall": sum(c["recall"] for c in per_class) / n,
            "f1": sum(c["f1"] for c in per_class) / n,
        },
        "weighted": {
            "precision": w_prec / total_support if total_support else 0,
            "recall": w_rec / total_support if total_support else 0,
            "f1": w_f1 / total_support if total_support else 0,
        },
        "total_samples": total_support,
    }


def save_evaluation_report(
    report: Dict,
    confusion: List[List[int]],
    class_names: List[str],
    output_dir: Path,
) -> None:
    """Persist evaluation artefacts: JSON report + CSV confusion matrix."""
    output_dir.mkdir(parents=True, exist_ok=True)

    # JSON report
    with (output_dir / "evaluation_report.json").open("w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, default=str)

    # CSV confusion matrix
    with (output_dir / "confusion_matrix.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["actual \\ predicted"] + class_names)
        for name, row in zip(class_names, confusion):
            writer.writerow([name] + row)

    # CSV per-class metrics
    with (output_dir / "classification_report.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["class", "precision", "recall", "f1", "support"])
        writer.writeheader()
        writer.writerows(report["per_class"])


# ══════════════════════════════════════════════════════════════════════════════
#  MODEL METADATA  —  saved alongside the .h5 for production serving
# ══════════════════════════════════════════════════════════════════════════════

def save_model_metadata(
    *,
    output_dir: Path,
    model_path: Path,
    class_names: List[str],
    display_names: List[str],
    evaluation: Dict,
    class_weights: Dict[int, float],
    image_size: int,
) -> None:
    """Write a JSON sidecar that documents everything about the saved model."""
    import tensorflow as tf

    metadata = {
        "name": "AgroMind Plant Disease Classifier",
        "version": "2.0",
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "tensorflow_version": tf.__version__,
        "model_path": str(model_path),
        "input": {
            "image_size": image_size,
            "shape": [1, image_size, image_size, 3],
            "dtype": "float32",
            "value_range": "0–255 (uint8) → normalised to 0–1 inside the model",
        },
        "output": {
            "activation": "softmax",
            "num_classes": len(class_names),
            "class_names": class_names,
            "display_names": display_names,
        },
        "training": {
            "class_weights": {str(k): round(v, 4) for k, v in class_weights.items()},
        },
        "evaluation": {k: float(v) for k, v in evaluation.items()},
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    with (output_dir / "model_metadata.json").open("w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    with (output_dir / "class_names.json").open("w", encoding="utf-8") as f:
        json.dump(display_names, f, indent=2)
