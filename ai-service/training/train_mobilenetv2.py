"""Train an AgroMind plant disease classifier with MobileNetV2.

Expected prepared PlantVillage folder layout:

data/processed/plantvillage/
  train/Tomato___healthy/
  validation/Tomato___healthy/
  test/Tomato___healthy/

Run from ai-service:
  python -m training.train_mobilenetv2 --data-dir data/processed/plantvillage
"""

from __future__ import annotations

import argparse
import csv
import json
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path

import tensorflow as tf
from tensorflow.keras import layers
from tensorflow.keras.applications import MobileNetV2

from training.preprocessing_pipeline import (
    ImagePipelineConfig,
    make_augmentation_layer,
    preprocess_dataset,
)


@dataclass(frozen=True)
class TrainingConfig:
    data_dir: Path
    output_dir: Path = Path("models")
    image_size: int = 224
    batch_size: int = 32
    seed: int = 42
    head_epochs: int = 10
    fine_tune_epochs: int = 10
    learning_rate: float = 1e-3
    fine_tune_learning_rate: float = 1e-5
    fine_tune_at: int = -1  # -1 means dynamic (e.g. unfreeze last 30%)
    dropout: float = 0.3
    label_smoothing: float = 0.05
    use_class_weights: bool = True
    early_stopping_patience: int = 5
    reduce_lr_patience: int = 2
    weights: str = "imagenet"
    shuffle_buffer_size: int = 1000


def parse_args() -> TrainingConfig:
    parser = argparse.ArgumentParser(
        description="Train a MobileNetV2 transfer-learning model on PlantVillage."
    )
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("models"))
    parser.add_argument("--image-size", type=int, default=224)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--head-epochs", type=int, default=10)
    parser.add_argument("--fine-tune-epochs", type=int, default=10)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument("--fine-tune-learning-rate", type=float, default=1e-5)
    parser.add_argument("--fine-tune-at", type=int, default=-1)
    parser.add_argument("--dropout", type=float, default=0.3)
    parser.add_argument("--label-smoothing", type=float, default=0.05)
    parser.add_argument(
        "--no-class-weights",
        action="store_true",
        help="Disable automatic class weights for imbalanced datasets.",
    )
    parser.add_argument("--early-stopping-patience", type=int, default=5)
    parser.add_argument("--reduce-lr-patience", type=int, default=2)
    parser.add_argument("--weights", choices=["imagenet", "none"], default="imagenet")
    parser.add_argument("--shuffle-buffer-size", type=int, default=1000)
    args = parser.parse_args()

    return TrainingConfig(
        data_dir=args.data_dir,
        output_dir=args.output_dir,
        image_size=args.image_size,
        batch_size=args.batch_size,
        seed=args.seed,
        head_epochs=args.head_epochs,
        fine_tune_epochs=args.fine_tune_epochs,
        learning_rate=args.learning_rate,
        fine_tune_learning_rate=args.fine_tune_learning_rate,
        fine_tune_at=args.fine_tune_at,
        dropout=args.dropout,
        label_smoothing=args.label_smoothing,
        use_class_weights=not args.no_class_weights,
        early_stopping_patience=args.early_stopping_patience,
        reduce_lr_patience=args.reduce_lr_patience,
        weights=args.weights,
        shuffle_buffer_size=args.shuffle_buffer_size,
    )


def ensure_dataset_exists(data_dir: Path) -> None:
    if not data_dir.exists():
        raise FileNotFoundError(f"Dataset folder not found: {data_dir}")
    for split_name in ("train", "validation", "test"):
        split_dir = data_dir / split_name
        if not split_dir.exists():
            raise FileNotFoundError(
                f"Missing '{split_name}' folder in {data_dir}. "
                "Run prepare_plantvillage.py before training."
            )
    class_dirs = [path for path in (data_dir / "train").iterdir() if path.is_dir()]
    if len(class_dirs) < 2:
        raise ValueError(
            "Prepared train folder must contain one subfolder per class, "
            "for example Tomato___healthy and Tomato___Late_blight."
        )


def load_datasets(config: TrainingConfig):
    image_shape = (config.image_size, config.image_size)

    train_dir = config.data_dir / "train"
    validation_dir = config.data_dir / "validation"
    test_dir = config.data_dir / "test"

    train_ds = tf.keras.utils.image_dataset_from_directory(
        train_dir,
        seed=config.seed,
        image_size=image_shape,
        batch_size=config.batch_size,
        label_mode="categorical",
        shuffle=True,
    )
    class_names = train_ds.class_names
    validation_ds = tf.keras.utils.image_dataset_from_directory(
        validation_dir,
        class_names=class_names,
        seed=config.seed,
        image_size=image_shape,
        batch_size=config.batch_size,
        label_mode="categorical",
        shuffle=False,
    )
    test_ds = tf.keras.utils.image_dataset_from_directory(
        test_dir,
        class_names=class_names,
        seed=config.seed,
        image_size=image_shape,
        batch_size=config.batch_size,
        label_mode="categorical",
        shuffle=False,
    )

    pipeline_config = ImagePipelineConfig(
        image_size=config.image_size,
        shuffle_buffer_size=config.shuffle_buffer_size,
        seed=config.seed,
    )
    train_ds = preprocess_dataset(train_ds, pipeline_config, training=True)
    validation_ds = preprocess_dataset(validation_ds, pipeline_config)
    test_ds = preprocess_dataset(test_ds, pipeline_config)

    return train_ds, validation_ds, test_ds, class_names


def count_training_images(data_dir: Path, class_names: list[str]) -> dict[str, int]:
    counts = {}
    for class_name in class_names:
        class_dir = data_dir / "train" / class_name
        counts[class_name] = sum(1 for path in class_dir.rglob("*") if path.is_file())
    return counts


def make_class_weights(class_counts: dict[str, int], class_names: list[str]) -> dict[int, float]:
    total = sum(class_counts.values())
    class_count = len(class_names)
    if total == 0 or class_count == 0:
        return {}

    return {
        index: total / (class_count * max(class_counts[class_name], 1))
        for index, class_name in enumerate(class_names)
    }

def build_model(config: TrainingConfig, class_count: int) -> tf.keras.Model:
    inputs = tf.keras.Input(shape=(config.image_size, config.image_size, 3))

    augmentation = make_augmentation_layer()

    x = augmentation(inputs)
    x = layers.Rescaling(scale=2.0, offset=-1.0, name="mobilenet_preprocess")(x)

    base_model = MobileNetV2(
        input_shape=(config.image_size, config.image_size, 3),
        include_top=False,
        weights=None if config.weights == "none" else config.weights,
    )
    base_model.trainable = False

    x = base_model(x, training=False)
    x = layers.GlobalAveragePooling2D(name="global_average_pooling")(x)
    
    # Advanced classification head with BatchNormalization and L2 Regularization
    x = layers.BatchNormalization(name="head_batch_norm_1")(x)
    x = layers.Dense(
        128, 
        activation="relu", 
        kernel_regularizer=tf.keras.regularizers.l2(0.01), 
        name="head_dense_1"
    )(x)
    x = layers.BatchNormalization(name="head_batch_norm_2")(x)
    x = layers.Dropout(config.dropout, name="head_dropout")(x)
    
    outputs = layers.Dense(class_count, activation="softmax", name="predictions")(x)

    return tf.keras.Model(inputs, outputs, name="agromind_mobilenetv2")


def compile_model(model: tf.keras.Model, learning_rate: float, label_smoothing: float) -> None:
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
        loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=label_smoothing),
        metrics=[
            "accuracy",
            tf.keras.metrics.TopKCategoricalAccuracy(k=3, name="top_3_accuracy"),
        ],
    )


def make_callbacks(config: TrainingConfig):
    output_dir = config.output_dir
    logs_dir = output_dir / "logs" / datetime.now().strftime("%Y%m%d-%H%M%S")
    checkpoint_path = output_dir / "checkpoints" / "best_model.keras"
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)

    return [
        tf.keras.callbacks.ModelCheckpoint(
            filepath=checkpoint_path,
            monitor="val_accuracy",
            mode="max",
            save_best_only=True,
            verbose=1,
        ),
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=config.early_stopping_patience,
            restore_best_weights=True,
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.2,
            patience=config.reduce_lr_patience,
            min_lr=1e-7,
            verbose=1,
        ),
        tf.keras.callbacks.CSVLogger(output_dir / "training_history.csv"),
        tf.keras.callbacks.TensorBoard(log_dir=logs_dir),
    ]


def fine_tune_model(model: tf.keras.Model, config: TrainingConfig) -> None:
    base_model = next(layer for layer in model.layers if layer.name.startswith("mobilenetv2"))
    base_model.trainable = True

    # Use dynamic fine-tuning if fine_tune_at is -1 (default: unfreeze last 30% of layers)
    total_layers = len(base_model.layers)
    fine_tune_idx = config.fine_tune_at if config.fine_tune_at >= 0 else int(total_layers * 0.7)

    for layer in base_model.layers[:fine_tune_idx]:
        layer.trainable = False

    compile_model(model, config.fine_tune_learning_rate, config.label_smoothing)


def clean_class_name(class_name: str) -> str:
    if "___" in class_name:
        crop, disease = class_name.split("___", maxsplit=1)
        return f"{crop.replace('_', ' ')} - {disease.replace('_', ' ')}"
    return class_name.replace("_", " ")


def save_class_names(class_names: list[str], output_dir: Path) -> list[str]:
    display_names = [clean_class_name(name) for name in class_names]
    with (output_dir / "class_names.json").open("w", encoding="utf-8") as file:
        json.dump(display_names, file, indent=2)
    with (output_dir / "raw_class_names.json").open("w", encoding="utf-8") as file:
        json.dump(class_names, file, indent=2)
    return display_names


def save_training_config(config: TrainingConfig, output_dir: Path) -> None:
    serializable = asdict(config)
    serializable["data_dir"] = str(config.data_dir)
    serializable["output_dir"] = str(config.output_dir)
    with (output_dir / "training_config.json").open("w", encoding="utf-8") as file:
        json.dump(serializable, file, indent=2)


def serialize_training_config(config: TrainingConfig) -> dict:
    payload = asdict(config)
    payload["data_dir"] = str(config.data_dir)
    payload["output_dir"] = str(config.output_dir)
    return payload


def collect_predictions(model: tf.keras.Model, test_ds: tf.data.Dataset) -> tuple[list[int], list[int], list[list[float]]]:
    y_true: list[int] = []
    y_pred: list[int] = []
    probabilities: list[list[float]] = []

    for images, labels in test_ds:
        batch_probabilities = model.predict(images, verbose=0)
        y_true.extend(tf.argmax(labels, axis=1).numpy().astype(int).tolist())
        y_pred.extend(tf.argmax(batch_probabilities, axis=1).numpy().astype(int).tolist())
        probabilities.extend(batch_probabilities.astype(float).tolist())

    return y_true, y_pred, probabilities


def build_confusion_matrix(y_true: list[int], y_pred: list[int], class_count: int) -> list[list[int]]:
    matrix = [[0 for _ in range(class_count)] for _ in range(class_count)]
    for truth, prediction in zip(y_true, y_pred):
        matrix[truth][prediction] += 1
    return matrix


def build_classification_report(
    confusion_matrix: list[list[int]],
    class_names: list[str],
) -> dict:
    per_class = []
    total_support = 0
    weighted_precision = 0.0
    weighted_recall = 0.0
    weighted_f1 = 0.0

    for index, class_name in enumerate(class_names):
        true_positive = confusion_matrix[index][index]
        false_positive = sum(row[index] for row in confusion_matrix) - true_positive
        false_negative = sum(confusion_matrix[index]) - true_positive
        support = sum(confusion_matrix[index])

        precision = (
            true_positive / (true_positive + false_positive)
            if true_positive + false_positive
            else 0.0
        )
        recall = (
            true_positive / (true_positive + false_negative)
            if true_positive + false_negative
            else 0.0
        )
        f1_score = (
            2 * precision * recall / (precision + recall)
            if precision + recall
            else 0.0
        )

        total_support += support
        weighted_precision += precision * support
        weighted_recall += recall * support
        weighted_f1 += f1_score * support

        per_class.append(
            {
                "class_name": class_name,
                "precision": precision,
                "recall": recall,
                "f1_score": f1_score,
                "support": support,
            }
        )

    class_count = max(len(class_names), 1)
    macro_average = {
        "precision": sum(item["precision"] for item in per_class) / class_count,
        "recall": sum(item["recall"] for item in per_class) / class_count,
        "f1_score": sum(item["f1_score"] for item in per_class) / class_count,
        "support": total_support,
    }
    weighted_average = {
        "precision": weighted_precision / total_support if total_support else 0.0,
        "recall": weighted_recall / total_support if total_support else 0.0,
        "f1_score": weighted_f1 / total_support if total_support else 0.0,
        "support": total_support,
    }

    return {
        "per_class": per_class,
        "macro_average": macro_average,
        "weighted_average": weighted_average,
    }


def write_confusion_matrix_csv(
    confusion_matrix: list[list[int]],
    class_names: list[str],
    output_dir: Path,
) -> None:
    with (output_dir / "confusion_matrix.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["actual\\predicted", *class_names])
        for class_name, row in zip(class_names, confusion_matrix):
            writer.writerow([class_name, *row])


def write_classification_report_csv(report: dict, output_dir: Path) -> None:
    with (output_dir / "classification_report.csv").open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=["class_name", "precision", "recall", "f1_score", "support"],
        )
        writer.writeheader()
        writer.writerows(report["per_class"])
        writer.writerow({"class_name": "macro_average", **report["macro_average"]})
        writer.writerow({"class_name": "weighted_average", **report["weighted_average"]})


def evaluate_and_save(
    model: tf.keras.Model,
    test_ds: tf.data.Dataset,
    output_dir: Path,
    class_names: list[str],
) -> dict:
    results = model.evaluate(test_ds, verbose=1, return_dict=True)
    y_true, y_pred, probabilities = collect_predictions(model, test_ds)
    confusion_matrix = build_confusion_matrix(y_true, y_pred, len(class_names))
    classification_report = build_classification_report(confusion_matrix, class_names)

    with (output_dir / "evaluation.json").open("w", encoding="utf-8") as file:
        json.dump({key: float(value) for key, value in results.items()}, file, indent=2)

    detailed_payload = {
        "metrics": {key: float(value) for key, value in results.items()},
        "class_names": class_names,
        "classification_report": classification_report,
        "confusion_matrix": confusion_matrix,
        "sample_count": len(y_true),
        "predictions": [
            {
                "actual_index": actual,
                "predicted_index": predicted,
                "actual_label": class_names[actual],
                "predicted_label": class_names[predicted],
                "probabilities": probability,
            }
            for actual, predicted, probability in zip(y_true, y_pred, probabilities)
        ],
    }
    with (output_dir / "evaluation_detailed.json").open("w", encoding="utf-8") as file:
        json.dump(detailed_payload, file, indent=2)

    write_confusion_matrix_csv(confusion_matrix, class_names, output_dir)
    write_classification_report_csv(classification_report, output_dir)

    return results


def save_model_metadata(
    config: TrainingConfig,
    output_dir: Path,
    model_path: Path,
    raw_class_names: list[str],
    display_class_names: list[str],
    evaluation: dict,
    class_counts: dict[str, int],
    class_weights: dict[int, float],
) -> None:
    metadata = {
        "artifact_name": "AgroMind leaf disease classifier",
        "model_format": model_path.suffix.lstrip(".") or "saved_model",
        "model_path": str(model_path),
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "tensorflow_version": tf.__version__,
        "input": {
            "image_size": config.image_size,
            "shape": [1, config.image_size, config.image_size, 3],
            "dtype": "float32",
            "value_range": "0..1",
        },
        "output": {
            "activation": "softmax",
            "class_count": len(display_class_names),
            "class_names": display_class_names,
            "raw_class_names": raw_class_names,
        },
        "training": serialize_training_config(config),
        "dataset": {
            "training_class_counts": class_counts,
            "class_weights": {str(index): weight for index, weight in class_weights.items()},
        },
        "evaluation": {key: float(value) for key, value in evaluation.items()},
        "runtime": {
            "load_with_compile": False,
            "recommended_warmup": True,
            "prediction_contract": "multipart image -> normalized batch -> top predictions",
        },
    }

    with (output_dir / "model_metadata.json").open("w", encoding="utf-8") as file:
        json.dump(metadata, file, indent=2)


def run_training(config: TrainingConfig) -> dict:
    """Run the full train, validation, evaluation, and artifact-saving workflow."""

    ensure_dataset_exists(config.data_dir)
    config.output_dir.mkdir(parents=True, exist_ok=True)

    train_ds, validation_ds, test_ds, class_names = load_datasets(config)
    class_counts = count_training_images(config.data_dir, class_names)
    class_weights = make_class_weights(class_counts, class_names) if config.use_class_weights else {}
    display_names = save_class_names(class_names, config.output_dir)
    save_training_config(config, config.output_dir)

    model = build_model(config, class_count=len(class_names))
    compile_model(model, config.learning_rate, config.label_smoothing)

    print("\nClasses:")
    for index, (raw_name, display_name) in enumerate(zip(class_names, display_names)):
        weight = class_weights.get(index, 1.0)
        print(
            f"  {index}: {display_name} ({raw_name}) "
            f"- train images: {class_counts[raw_name]}, class weight: {weight:.3f}"
        )

    callbacks = make_callbacks(config)

    print("\nStage 1: training the new classification head.")
    head_history = model.fit(
        train_ds,
        validation_data=validation_ds,
        epochs=config.head_epochs,
        callbacks=callbacks,
        class_weight=class_weights or None,
    )

    if config.fine_tune_epochs > 0:
        print("\nStage 2: fine-tuning the upper MobileNetV2 layers.")
        fine_tune_model(model, config)
        model.fit(
            train_ds,
            validation_data=validation_ds,
            epochs=config.head_epochs + config.fine_tune_epochs,
            initial_epoch=len(head_history.history["loss"]),
            callbacks=callbacks,
            class_weight=class_weights or None,
        )
    else:
        print("\nStage 2 skipped because fine_tune_epochs is 0.")

    checkpoint_path = config.output_dir / "checkpoints" / "best_model.keras"
    if checkpoint_path.exists():
        print(f"\nLoading best validation checkpoint: {checkpoint_path}")
        model = tf.keras.models.load_model(checkpoint_path, compile=False)
        compile_model(model, config.fine_tune_learning_rate, config.label_smoothing)

    print("\nFinal evaluation on held-out test data.")
    evaluation = evaluate_and_save(model, test_ds, config.output_dir, display_names)

    final_model_path = config.output_dir / "leaf_disease_model.keras"
    model.save(final_model_path, include_optimizer=False)
    save_model_metadata(
        config=config,
        output_dir=config.output_dir,
        model_path=final_model_path,
        raw_class_names=class_names,
        display_class_names=display_names,
        evaluation=evaluation,
        class_counts=class_counts,
        class_weights=class_weights,
    )

    print("\nTraining complete.")
    print(f"Saved model: {final_model_path}")
    print(f"Saved labels: {config.output_dir / 'class_names.json'}")
    print(f"Saved metadata: {config.output_dir / 'model_metadata.json'}")
    print(f"Test accuracy: {evaluation.get('accuracy', 0):.4f}")
    print(f"Top-3 accuracy: {evaluation.get('top_3_accuracy', 0):.4f}")

    return {
        "model_path": str(final_model_path),
        "class_names_path": str(config.output_dir / "class_names.json"),
        "metadata_path": str(config.output_dir / "model_metadata.json"),
        "evaluation": {key: float(value) for key, value in evaluation.items()},
    }


def main() -> None:
    run_training(parse_args())


if __name__ == "__main__":
    main()
