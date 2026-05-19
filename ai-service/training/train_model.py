"""
AgroMind AI — Main Training Script (train_model.py)

PRODUCTION-LEVEL training pipeline for the AgroMind plant disease classifier.
Uses MobileNetV2 transfer learning with a two-stage training strategy:

  Stage 1 — HEAD TRAINING:   Freeze MobileNetV2, train only the new classifier.
  Stage 2 — FINE-TUNING:     Unfreeze top 30% of MobileNetV2, train with tiny LR.

Run from ai-service/:
  python -m training.train_model

BEGINNER GUIDE — KEY CONCEPTS
==============================

CNN (Convolutional Neural Network):
    A neural network that uses sliding filters to detect visual patterns
    in images. Early layers learn edges, middle layers learn shapes, deep
    layers learn complex concepts like "blight spots on a leaf".

Transfer Learning:
    Instead of training a CNN from scratch (needs millions of images), we
    take MobileNetV2 pre-trained on 14M ImageNet images and reuse its
    learned features. We only train a new "head" for our 5 disease classes.

MobileNetV2:
    A lightweight CNN (3.4M params) designed for mobile devices. Uses
    "depthwise separable convolutions" to be fast yet accurate — perfect
    for running on farmers' phones via TFLite.

Epochs:
    One epoch = one full pass through all training images. We use ~15 epochs
    for head training and ~15 more for fine-tuning.

Batches:
    Images are grouped into batches of 32 for GPU efficiency. One epoch
    processes all batches sequentially.

Overfitting:
    When a model memorises training images instead of learning general
    patterns. We fight it with: dropout, data augmentation, early stopping,
    L2 regularisation, and label smoothing.

Validation Accuracy:
    Accuracy measured on images the model has NEVER seen during training.
    This is the true measure of how well the model will work in the real world.

Augmentation:
    Randomly flipping, rotating, zooming, and adjusting brightness of
    training images to artificially increase dataset diversity.

Preprocessing:
    Converting raw images to the format the model expects: resize to 224x224,
    normalise pixel values from [0,255] to [0,1].
"""
from __future__ import annotations

import io
import json
import sys
from datetime import datetime
from pathlib import Path

# Fix Windows terminal encoding for unicode output
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    sys.stdout = io.TextIOWrapper(
        sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True
    )
    sys.stderr = io.TextIOWrapper(
        sys.stderr.buffer, encoding='utf-8', errors='replace', line_buffering=True
    )

import tensorflow as tf

# -- Add project root to path for imports -------------------------------------
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from utils.config import PipelineConfig
from utils.helpers import (
    build_classification_report,
    build_confusion_matrix,
    clean_class_name,
    compute_class_weights,
    count_images_per_class,
    save_evaluation_report,
    save_model_metadata,
)
from training.dataset_loader import load_all_datasets
from training.prepare_plantvillage import DatasetPrepConfig, prepare_dataset
from models.mobilenet_model import (
    build_mobilenetv2_model,
    compile_model,
    unfreeze_for_fine_tuning,
)


def print_banner() -> None:
    """Print a styled startup banner."""
    print("\n" + "=" * 70)
    print("  [*] AgroMind AI - Plant Disease Classifier Training Pipeline")
    print("  [i] MobileNetV2 Transfer Learning | TensorFlow " + tf.__version__)
    print("=" * 70)


def prepare_data(cfg: PipelineConfig) -> None:
    """Stage 0: Prepare raw dataset into train/validation/test splits."""
    print("\n" + "-" * 70)
    print("  [>] STAGE 0: Dataset Preparation")
    print("-" * 70)

    prepare_dataset(DatasetPrepConfig(
        raw_dir=cfg.dataset_dir,
        output_dir=cfg.processed_dir,
        image_size=cfg.image_size,
        train_ratio=cfg.train_ratio,
        validation_ratio=cfg.validation_ratio,
        test_ratio=cfg.test_ratio,
        seed=cfg.seed,
        min_images_per_class=10,
        clean=True,
        normalize_labels=True,
    ))


def make_callbacks(cfg: PipelineConfig) -> list:
    """Create training callbacks for monitoring and checkpointing.

    BEGINNER GUIDE — CALLBACKS
        Callbacks are functions that run automatically during training:
        - ModelCheckpoint:  Saves the best model whenever val_accuracy improves.
        - EarlyStopping:    Stops training if val_loss hasn't improved in N epochs.
                            Restores the best weights automatically.
        - ReduceLROnPlateau: Cuts the learning rate when val_loss stalls.
        - CSVLogger:        Logs loss/accuracy per epoch to a CSV file.
        - TensorBoard:      Creates visual training dashboards.
    """
    output_dir = cfg.output_dir
    logs_dir = output_dir / "logs" / datetime.now().strftime("%Y%m%d-%H%M%S")
    checkpoint_path = output_dir / "checkpoints" / "best_model.keras"
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)

    return [
        tf.keras.callbacks.ModelCheckpoint(
            filepath=str(checkpoint_path),
            monitor="val_accuracy",
            mode="max",
            save_best_only=True,
            verbose=1,
        ),
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=cfg.early_stopping_patience,
            restore_best_weights=True,
            verbose=1,
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor="val_loss",
            factor=cfg.reduce_lr_factor,
            patience=cfg.reduce_lr_patience,
            min_lr=cfg.min_lr,
            verbose=1,
        ),
        tf.keras.callbacks.CSVLogger(str(output_dir / "training_history.csv")),
        tf.keras.callbacks.TensorBoard(log_dir=str(logs_dir)),
    ]


def train_head(model, train_ds, val_ds, cfg, callbacks, class_weights):
    """Stage 1: Train only the classification head (MobileNetV2 frozen)."""
    print("\n" + "-" * 70)
    print("  [>] STAGE 1: Training Classification Head")
    print("  [i] MobileNetV2 layers are FROZEN - only the head learns")
    print("-" * 70)

    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=cfg.head_epochs,
        callbacks=callbacks,
        class_weight=class_weights or None,
    )
    return history


def fine_tune(model, train_ds, val_ds, cfg, callbacks, class_weights, initial_epoch):
    """Stage 2: Fine-tune the top layers of MobileNetV2."""
    print("\n" + "-" * 70)
    print("  [>] STAGE 2: Fine-Tuning MobileNetV2 Top Layers")
    print("  [i] Top 30% of MobileNetV2 is now UNFROZEN with tiny LR")
    print("-" * 70)

    unfreeze_for_fine_tuning(
        model,
        fine_tune_fraction=cfg.fine_tune_fraction,
        fine_tune_lr=cfg.fine_tune_lr,
        label_smoothing=cfg.label_smoothing,
    )

    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=cfg.head_epochs + cfg.fine_tune_epochs,
        initial_epoch=initial_epoch,
        callbacks=callbacks,
        class_weight=class_weights or None,
    )


def evaluate_model(model, test_ds, class_names, output_dir):
    """Stage 3: Evaluate the trained model on the held-out test set."""
    print("\n" + "-" * 70)
    print("  [>] STAGE 3: Final Evaluation on Test Set")
    print("-" * 70)

    # Overall metrics
    results = model.evaluate(test_ds, verbose=1, return_dict=True)

    # Per-sample predictions
    y_true, y_pred = [], []
    for images, labels in test_ds:
        preds = model.predict(images, verbose=0)
        y_true.extend(tf.argmax(labels, axis=1).numpy().tolist())
        y_pred.extend(tf.argmax(preds, axis=1).numpy().tolist())

    # Build detailed report
    confusion = build_confusion_matrix(y_true, y_pred, len(class_names))
    report = build_classification_report(confusion, class_names)

    # Save reports
    save_evaluation_report(report, confusion, class_names, output_dir)

    # Print per-class summary
    print("\n  [+] Per-Class Results:")
    print(f"  {'Class':<30} {'Precision':>10} {'Recall':>10} {'F1':>10}")
    print("  " + "-" * 62)
    for item in report["per_class"]:
        print(f"  {item['class']:<30} {item['precision']:>10.4f} "
              f"{item['recall']:>10.4f} {item['f1']:>10.4f}")
    print("  " + "-" * 62)
    print(f"  {'Weighted Average':<30} {report['weighted']['precision']:>10.4f} "
          f"{report['weighted']['recall']:>10.4f} {report['weighted']['f1']:>10.4f}")

    return results


def save_final_model(model, cfg, class_names, evaluation, class_weights):
    """Stage 4: Save the trained model and metadata.

    NOTE on TF 2.18+ and .h5 format:
        Models containing RandomBrightness / RandomContrast augmentation layers
        cannot be saved in legacy .h5 format (causes 'cannot pickle module' error).
        We save as .keras (full model) + .weights.h5 (weights only, for compat).
    """
    print("\n" + "-" * 70)
    print("  [>] STAGE 4: Saving Production Model")
    print("-" * 70)

    output_dir = cfg.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    # Primary format: .keras (TF native, full model)
    keras_path = output_dir / "plant_disease_model.keras"
    model.save(str(keras_path), include_optimizer=False)
    print(f"  [OK] Model saved: {keras_path}")

    # Compatibility: .weights.h5 (weights only, TF 2.18 requires this extension)
    weights_path = output_dir / "plant_disease_model.weights.h5"
    model.save_weights(str(weights_path))
    print(f"  [OK] Weights saved: {weights_path}")

    # Save metadata
    display_names = [clean_class_name(n) for n in class_names]
    save_model_metadata(
        output_dir=output_dir,
        model_path=keras_path,
        class_names=class_names,
        display_names=display_names,
        evaluation=evaluation,
        class_weights=class_weights,
        image_size=cfg.image_size,
    )
    print(f"  [OK] Metadata saved: {output_dir / 'model_metadata.json'}")
    print(f"  [OK] Class names saved: {output_dir / 'class_names.json'}")


def run_training_pipeline(cfg: PipelineConfig | None = None) -> dict:
    """Execute the complete AgroMind training pipeline.

    This is the main entry point. It runs all stages in order:
      0. Prepare dataset (split into train/val/test)
      1. Train classification head (frozen MobileNetV2)
      2. Fine-tune top MobileNetV2 layers
      3. Evaluate on test set
      4. Save model and metadata

    Returns:
        Summary dict with model path and evaluation metrics.
    """
    if cfg is None:
        cfg = PipelineConfig()

    print_banner()
    cfg.output_dir.mkdir(parents=True, exist_ok=True)

    # ── Stage 0: Prepare dataset ─────────────────────────────────────────
    prepare_data(cfg)

    # ── Load datasets ────────────────────────────────────────────────────
    train_ds, val_ds, test_ds, class_names = load_all_datasets(
        data_dir=cfg.processed_dir,
        image_size=cfg.image_size,
        batch_size=cfg.batch_size,
        seed=cfg.seed,
        shuffle_buffer=cfg.shuffle_buffer,
    )

    # ── Compute class weights ────────────────────────────────────────────
    class_counts = count_images_per_class(cfg.processed_dir, class_names)
    class_weights = compute_class_weights(class_counts, class_names)

    print("\n  [+] Dataset Distribution:")
    for i, name in enumerate(class_names):
        count = class_counts.get(name, 0)
        weight = class_weights.get(i, 1.0)
        print(f"    {i}: {name:<30} {count:>5} images | weight: {weight:.3f}")

    # ── Build model ──────────────────────────────────────────────────────
    model = build_mobilenetv2_model(
        num_classes=len(class_names),
        image_size=cfg.image_size,
        dropout=cfg.dropout,
        l2_reg=cfg.l2_reg,
    )
    compile_model(model, cfg.learning_rate, cfg.label_smoothing)

    print(f"\n  [+] Model Parameters: {model.count_params():,}")
    trainable = sum(tf.keras.backend.count_params(w) for w in model.trainable_weights)
    print(f"  [>] Trainable: {trainable:,}")
    print(f"  [x] Frozen: {model.count_params() - trainable:,}")

    # ── Create callbacks ─────────────────────────────────────────────────
    callbacks = make_callbacks(cfg)

    # ── Stage 1: Train head ──────────────────────────────────────────────
    head_history = train_head(model, train_ds, val_ds, cfg, callbacks, class_weights)
    initial_epoch = len(head_history.history["loss"])

    # ── Stage 2: Fine-tune ───────────────────────────────────────────────
    if cfg.fine_tune_epochs > 0:
        fine_tune(model, train_ds, val_ds, cfg, callbacks, class_weights, initial_epoch)

    # ── Load best checkpoint ─────────────────────────────────────────────
    best_ckpt = cfg.output_dir / "checkpoints" / "best_model.keras"
    if best_ckpt.exists():
        print(f"\n  [+] Loading best checkpoint: {best_ckpt}")
        model = tf.keras.models.load_model(str(best_ckpt), compile=False)
        compile_model(model, cfg.fine_tune_lr, cfg.label_smoothing)

    # ── Stage 3: Evaluate ────────────────────────────────────────────────
    evaluation = evaluate_model(model, test_ds, class_names, cfg.output_dir)

    # ── Stage 4: Save ────────────────────────────────────────────────────
    save_final_model(model, cfg, class_names, evaluation, class_weights)

    # ── Summary ──────────────────────────────────────────────────────────
    model_path = cfg.output_dir / "plant_disease_model.keras"
    print("\n" + "=" * 70)
    print("  [*] TRAINING COMPLETE!")
    print(f"  [+] Test Accuracy:  {evaluation.get('accuracy', 0):.4f}")
    print(f"  [+] Top-3 Accuracy: {evaluation.get('top3_accuracy', 0):.4f}")
    print(f"  [>] Model saved to: {model_path}")
    print("=" * 70 + "\n")

    return {
        "model_path": str(model_path),
        "evaluation": {k: float(v) for k, v in evaluation.items()},
    }


# ══════════════════════════════════════════════════════════════════════════════
#  ENTRY POINT — run with: python -m training.train_model
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    run_training_pipeline()
