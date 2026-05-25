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
    fine_tune_at: int = 100
    dropout: float = 0.25
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
    parser.add_argument("--fine-tune-at", type=int, default=100)
    parser.add_argument("--dropout", type=float, default=0.25)
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
    )
    class_names = train_ds.class_names
    validation_ds = tf.keras.utils.image_dataset_from_directory(
        validation_dir,
        class_names=class_names,
        seed=config.seed,
        image_size=image_shape,
        batch_size=config.batch_size,
        label_mode="categorical",
    )
    test_ds = tf.keras.utils.image_dataset_from_directory(
        test_dir,
        class_names=class_names,
        seed=config.seed,
        image_size=image_shape,
        batch_size=config.batch_size,
        label_mode="categorical",
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
    x = layers.Dropout(config.dropout, name="dropout")(x)
    outputs = layers.Dense(class_count, activation="softmax", name="predictions")(x)

    return tf.keras.Model(inputs, outputs, name="agromind_mobilenetv2")


def compile_model(model: tf.keras.Model, learning_rate: float) -> None:
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate),
        loss="categorical_crossentropy",
        metrics=[
            "accuracy",
            tf.keras.metrics.TopKCategoricalAccuracy(k=3, name="top_3_accuracy"),
        ],
    )


def make_callbacks(output_dir: Path):
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
            patience=5,
            restore_best_weights=True,
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.2,
            patience=2,
            min_lr=1e-7,
            verbose=1,
        ),
        tf.keras.callbacks.CSVLogger(output_dir / "training_history.csv"),
        tf.keras.callbacks.TensorBoard(log_dir=logs_dir),
    ]


def fine_tune_model(model: tf.keras.Model, config: TrainingConfig) -> None:
    base_model = next(layer for layer in model.layers if layer.name.startswith("mobilenetv2"))
    base_model.trainable = True

    for layer in base_model.layers[: config.fine_tune_at]:
        layer.trainable = False

    compile_model(model, config.fine_tune_learning_rate)


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


def evaluate_and_save(model: tf.keras.Model, test_ds: tf.data.Dataset, output_dir: Path) -> dict:
    results = model.evaluate(test_ds, verbose=1, return_dict=True)
    with (output_dir / "evaluation.json").open("w", encoding="utf-8") as file:
        json.dump({key: float(value) for key, value in results.items()}, file, indent=2)
    return results


def main() -> None:
    config = parse_args()
    ensure_dataset_exists(config.data_dir)
    config.output_dir.mkdir(parents=True, exist_ok=True)

    train_ds, validation_ds, test_ds, class_names = load_datasets(config)
    display_names = save_class_names(class_names, config.output_dir)
    save_training_config(config, config.output_dir)

    model = build_model(config, class_count=len(class_names))
    compile_model(model, config.learning_rate)

    print("\nClasses:")
    for index, (raw_name, display_name) in enumerate(zip(class_names, display_names)):
        print(f"  {index}: {display_name} ({raw_name})")

    callbacks = make_callbacks(config.output_dir)

    print("\nStage 1: training the new classification head.")
    head_history = model.fit(
        train_ds,
        validation_data=validation_ds,
        epochs=config.head_epochs,
        callbacks=callbacks,
    )

    print("\nStage 2: fine-tuning the upper MobileNetV2 layers.")
    fine_tune_model(model, config)
    fine_tune_history = model.fit(
        train_ds,
        validation_data=validation_ds,
        epochs=config.head_epochs + config.fine_tune_epochs,
        initial_epoch=len(head_history.history["loss"]),
        callbacks=callbacks,
    )

    print("\nFinal evaluation on held-out test data.")
    evaluation = evaluate_and_save(model, test_ds, config.output_dir)

    final_model_path = config.output_dir / "leaf_disease_model.keras"
    model.save(final_model_path)

    print("\nTraining complete.")
    print(f"Saved model: {final_model_path}")
    print(f"Saved labels: {config.output_dir / 'class_names.json'}")
    print(f"Test accuracy: {evaluation.get('accuracy', 0):.4f}")
    print(f"Top-3 accuracy: {evaluation.get('top_3_accuracy', 0):.4f}")


if __name__ == "__main__":
    main()
