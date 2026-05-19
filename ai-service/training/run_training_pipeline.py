"""End-to-end AgroMind training pipeline.

This command starts from the raw local PlantVillage-style dataset folder,
prepares train/validation/test splits, trains MobileNetV2, evaluates the best
checkpoint, and saves production serving artifacts.

Run from ai-service:
  python -m training.run_training_pipeline --raw-dir dataset --output-dir models
"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path

from training.prepare_plantvillage import DatasetPrepConfig, prepare_dataset
from training.train_mobilenetv2 import TrainingConfig, run_training


@dataclass(frozen=True)
class TrainingPipelineConfig:
    raw_dir: Path = Path("dataset")
    processed_dir: Path = Path("data/processed/plantvillage")
    output_dir: Path = Path("models")
    image_size: int = 224
    batch_size: int = 32
    seed: int = 42
    train_ratio: float = 0.7
    validation_ratio: float = 0.15
    test_ratio: float = 0.15
    head_epochs: int = 15
    fine_tune_epochs: int = 15
    learning_rate: float = 1e-3
    fine_tune_learning_rate: float = 1e-5
    dropout: float = 0.3
    label_smoothing: float = 0.05
    early_stopping_patience: int = 5
    reduce_lr_patience: int = 2
    min_images_per_class: int = 10
    normalize_labels: bool = True
    clean: bool = True
    use_class_weights: bool = True
    weights: str = "imagenet"


def parse_args() -> TrainingPipelineConfig:
    parser = argparse.ArgumentParser(
        description="Prepare PlantVillage data and train AgroMind MobileNetV2 end to end."
    )
    parser.add_argument("--raw-dir", type=Path, default=Path("dataset"))
    parser.add_argument("--processed-dir", type=Path, default=Path("data/processed/plantvillage"))
    parser.add_argument("--output-dir", type=Path, default=Path("models"))
    parser.add_argument("--image-size", type=int, default=224)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--train-ratio", type=float, default=0.7)
    parser.add_argument("--validation-ratio", type=float, default=0.15)
    parser.add_argument("--test-ratio", type=float, default=0.15)
    parser.add_argument("--head-epochs", type=int, default=15)
    parser.add_argument("--fine-tune-epochs", type=int, default=15)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument("--fine-tune-learning-rate", type=float, default=1e-5)
    parser.add_argument("--dropout", type=float, default=0.3)
    parser.add_argument("--label-smoothing", type=float, default=0.05)
    parser.add_argument("--early-stopping-patience", type=int, default=5)
    parser.add_argument("--reduce-lr-patience", type=int, default=2)
    parser.add_argument("--min-images-per-class", type=int, default=10)
    parser.add_argument("--no-normalize-labels", action="store_true")
    parser.add_argument("--no-clean", action="store_true")
    parser.add_argument("--no-class-weights", action="store_true")
    parser.add_argument("--weights", choices=["imagenet", "none"], default="imagenet")
    args = parser.parse_args()

    return TrainingPipelineConfig(
        raw_dir=args.raw_dir,
        processed_dir=args.processed_dir,
        output_dir=args.output_dir,
        image_size=args.image_size,
        batch_size=args.batch_size,
        seed=args.seed,
        train_ratio=args.train_ratio,
        validation_ratio=args.validation_ratio,
        test_ratio=args.test_ratio,
        head_epochs=args.head_epochs,
        fine_tune_epochs=args.fine_tune_epochs,
        learning_rate=args.learning_rate,
        fine_tune_learning_rate=args.fine_tune_learning_rate,
        dropout=args.dropout,
        label_smoothing=args.label_smoothing,
        early_stopping_patience=args.early_stopping_patience,
        reduce_lr_patience=args.reduce_lr_patience,
        min_images_per_class=args.min_images_per_class,
        normalize_labels=not args.no_normalize_labels,
        clean=not args.no_clean,
        use_class_weights=not args.no_class_weights,
        weights=args.weights,
    )


def serialize_config(config: TrainingPipelineConfig) -> dict:
    payload = asdict(config)
    payload["raw_dir"] = str(config.raw_dir)
    payload["processed_dir"] = str(config.processed_dir)
    payload["output_dir"] = str(config.output_dir)
    return payload


def run_pipeline(config: TrainingPipelineConfig) -> dict:
    print("\nAgroMind training pipeline started.")
    print(f"Raw dataset: {config.raw_dir}")
    print(f"Processed dataset: {config.processed_dir}")
    print(f"Model output: {config.output_dir}")

    prepare_dataset(
        DatasetPrepConfig(
            raw_dir=config.raw_dir,
            output_dir=config.processed_dir,
            image_size=config.image_size,
            train_ratio=config.train_ratio,
            validation_ratio=config.validation_ratio,
            test_ratio=config.test_ratio,
            seed=config.seed,
            min_images_per_class=config.min_images_per_class,
            clean=config.clean,
            normalize_labels=config.normalize_labels,
        )
    )

    result = run_training(
        TrainingConfig(
            data_dir=config.processed_dir,
            output_dir=config.output_dir,
            image_size=config.image_size,
            batch_size=config.batch_size,
            seed=config.seed,
            head_epochs=config.head_epochs,
            fine_tune_epochs=config.fine_tune_epochs,
            learning_rate=config.learning_rate,
            fine_tune_learning_rate=config.fine_tune_learning_rate,
            dropout=config.dropout,
            label_smoothing=config.label_smoothing,
            use_class_weights=config.use_class_weights,
            early_stopping_patience=config.early_stopping_patience,
            reduce_lr_patience=config.reduce_lr_patience,
            weights=config.weights,
        )
    )

    summary = {
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "pipeline_config": serialize_config(config),
        "training_result": result,
        "artifacts": {
            "dataset_report": str(config.processed_dir / "dataset_report.json"),
            "dataset_manifest": str(config.processed_dir / "dataset_manifest.csv"),
            "training_history": str(config.output_dir / "training_history.csv"),
            "best_checkpoint": str(config.output_dir / "checkpoints" / "best_model.keras"),
            "final_model": result["model_path"],
            "evaluation": str(config.output_dir / "evaluation.json"),
            "classification_report": str(config.output_dir / "classification_report.csv"),
            "confusion_matrix": str(config.output_dir / "confusion_matrix.csv"),
            "metadata": result["metadata_path"],
        },
    }

    with (config.output_dir / "pipeline_summary.json").open("w", encoding="utf-8") as file:
        json.dump(summary, file, indent=2)

    print("\nPipeline complete.")
    print(f"Summary: {config.output_dir / 'pipeline_summary.json'}")
    return summary


def main() -> None:
    run_pipeline(parse_args())


if __name__ == "__main__":
    main()
