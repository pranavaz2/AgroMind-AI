"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  AgroMind AI — Central Configuration                                       ║
║                                                                            ║
║  Every "magic number" the pipeline uses lives here so you can tweak the    ║
║  entire training run from a single file.                                   ║
╚══════════════════════════════════════════════════════════════════════════════╝

📖 BEGINNER GUIDE — KEY CONCEPTS
─────────────────────────────────
IMAGE_SIZE (224×224)
    MobileNetV2 was *originally trained* on 224×224 images. By keeping the
    same size we let the pre-trained filters work at the resolution they
    already understand — transferring knowledge most efficiently.

BATCH_SIZE (32)
    Instead of feeding images one-by-one, we group 32 images into a single
    "batch".  Larger batches = faster training (GPU parallelism) but use more
    memory.  32 is the sweet-spot for most consumer GPUs (4-8 GB VRAM).

EPOCHS
    One *epoch* = one full pass over the entire training dataset.
    • HEAD_EPOCHS: We first train *only* the new classification head while
      MobileNetV2's body stays frozen ("feature extractor" mode).
    • FINE_TUNE_EPOCHS: Then we unfreeze the top layers of MobileNetV2 and
      train them with a *much smaller* learning rate so we nudge (not
      destroy) the pre-trained weights.

LEARNING_RATE
    Controls how big each weight update step is.
    • Too large → the model overshoots good solutions and never converges.
    • Too small → training takes forever and can get stuck.
    We use 1e-3 for the head (it starts from random weights so big steps are
    fine) and 1e-5 for fine-tuning (small nudges to pre-trained weights).

DROPOUT (0.35)
    During training, 35 % of the neurons in the classification head are
    randomly "turned off" each step.  This forces the network to learn
    redundant representations and is one of the best weapons against
    *overfitting* (memorising training images instead of learning general
    patterns).

LABEL_SMOOTHING (0.05)
    Instead of telling the model "this is 100 % Tomato_healthy", we say
    "97.5 % Tomato_healthy, 0.625 % each other class".  This makes the model
    less over-confident and improves generalisation.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import List


# ──────────────────────────────────────────────────────────────────────────────
# 1.  PATHS  —  where data lives and where outputs go
# ──────────────────────────────────────────────────────────────────────────────
DATASET_DIR = Path("dataset")                       # raw images (class sub-folders)
PROCESSED_DIR = Path("data/processed/plantvillage")  # prepared train/val/test splits
MODEL_OUTPUT_DIR = Path("models")                    # training artefacts
FINAL_MODEL_PATH = Path("models/plant_disease_model.h5")  # the file you deploy

# ──────────────────────────────────────────────────────────────────────────────
# 2.  CLASS NAMES  —  must match the sub-folder names in DATASET_DIR
# ──────────────────────────────────────────────────────────────────────────────
CLASS_NAMES: List[str] = [
    "Potato___Early_blight",
    "Potato___healthy",
    "Tomato_Early_blight",
    "Tomato_Late_blight",
    "Tomato_healthy",
]

NUM_CLASSES: int = len(CLASS_NAMES)

# ──────────────────────────────────────────────────────────────────────────────
# 3.  IMAGE & PIPELINE SETTINGS
# ──────────────────────────────────────────────────────────────────────────────
IMAGE_SIZE: int = 224        # MobileNetV2 native resolution
BATCH_SIZE: int = 32         # images per training step
SEED: int = 42               # for reproducibility
SHUFFLE_BUFFER: int = 1000   # tf.data shuffle window

# ──────────────────────────────────────────────────────────────────────────────
# 4.  SPLIT RATIOS  —  how the dataset is carved up
# ──────────────────────────────────────────────────────────────────────────────
TRAIN_RATIO: float = 0.70    # 70 % for training
VALIDATION_RATIO: float = 0.15  # 15 % for validation (tuning)
TEST_RATIO: float = 0.15     # 15 % for final evaluation

# ──────────────────────────────────────────────────────────────────────────────
# 5.  TRAINING HYPER-PARAMETERS
# ──────────────────────────────────────────────────────────────────────────────
HEAD_EPOCHS: int = 20         # epochs with frozen MobileNetV2
FINE_TUNE_EPOCHS: int = 20    # extra epochs after unfreezing top layers
LEARNING_RATE: float = 5e-4   # head training (gentler than 1e-3 for stability)
FINE_TUNE_LR: float = 1e-5    # fine-tuning (very small nudges)
DROPOUT: float = 0.30         # fraction of neurons to drop in the head
LABEL_SMOOTHING: float = 0.05 # soft targets for better generalisation
L2_REGULARISATION: float = 0.001  # weight-decay (0.01 was too heavy)

# ──────────────────────────────────────────────────────────────────────────────
# 6.  CALLBACKS
# ──────────────────────────────────────────────────────────────────────────────
EARLY_STOPPING_PATIENCE: int = 7   # stop if val_loss hasn't improved in N epochs
REDUCE_LR_PATIENCE: int = 3        # reduce LR if val_loss stalls for N epochs
REDUCE_LR_FACTOR: float = 0.2      # multiply LR by this when reducing
MIN_LR: float = 1e-7               # never go below this learning rate

# ──────────────────────────────────────────────────────────────────────────────
# 7.  FINE-TUNING STRATEGY
# ──────────────────────────────────────────────────────────────────────────────
FINE_TUNE_FRACTION: float = 0.40    # unfreeze the last 40% of MobileNetV2 layers


@dataclass(frozen=True)
class PipelineConfig:
    """A single object that bundles every setting for one training run.

    Using a dataclass keeps the pipeline deterministic and makes it trivial
    to serialise every run's configuration alongside the saved model.
    """

    # Paths
    dataset_dir: Path = DATASET_DIR
    processed_dir: Path = PROCESSED_DIR
    output_dir: Path = MODEL_OUTPUT_DIR
    final_model_path: Path = FINAL_MODEL_PATH

    # Data
    class_names: List[str] = field(default_factory=lambda: list(CLASS_NAMES))
    image_size: int = IMAGE_SIZE
    batch_size: int = BATCH_SIZE
    seed: int = SEED
    shuffle_buffer: int = SHUFFLE_BUFFER

    # Splits
    train_ratio: float = TRAIN_RATIO
    validation_ratio: float = VALIDATION_RATIO
    test_ratio: float = TEST_RATIO

    # Training
    head_epochs: int = HEAD_EPOCHS
    fine_tune_epochs: int = FINE_TUNE_EPOCHS
    learning_rate: float = LEARNING_RATE
    fine_tune_lr: float = FINE_TUNE_LR
    dropout: float = DROPOUT
    label_smoothing: float = LABEL_SMOOTHING
    l2_reg: float = L2_REGULARISATION

    # Callbacks
    early_stopping_patience: int = EARLY_STOPPING_PATIENCE
    reduce_lr_patience: int = REDUCE_LR_PATIENCE
    reduce_lr_factor: float = REDUCE_LR_FACTOR
    min_lr: float = MIN_LR

    # Fine-tune
    fine_tune_fraction: float = FINE_TUNE_FRACTION

    @property
    def num_classes(self) -> int:
        return len(self.class_names)
