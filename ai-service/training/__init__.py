"""Training utilities for AgroMind plant disease models.

Modules:
    train_model       — Main training pipeline entry point
    dataset_loader    — tf.data.Dataset loading and preprocessing
    prepare_plantvillage — Raw dataset → train/val/test splits
    train_mobilenetv2 — Legacy training script (kept for backwards compat)
"""
