"""
AgroMind AI -- TensorFlow Dataset Loader

Loads images from prepared train/validation/test folders into
high-performance tf.data.Dataset pipelines.

BEGINNER GUIDE -- WHY tf.data.Dataset?
    Instead of loading ALL images into RAM at once, tf.data.Dataset:
    1. Loads images lazily -- only when the GPU needs them.
    2. Uses prefetching -- CPU loads batch N+1 while GPU trains on batch N.
    3. Uses caching -- preprocessed images are stored so no re-decode each epoch.
    4. Uses parallel mapping -- multiple CPU cores decode images simultaneously.

BEGINNER GUIDE -- PREPROCESSING PIPELINE
    Raw JPEG -> Decode -> Resize to 224x224 -> float32 [0, 255] -> Cache -> Prefetch

    IMPORTANT: We do NOT normalise to [0, 1] here!
    MobileNetV2 expects [0, 255] input -- the model's internal Rescaling layer
    converts [0, 255] -> [-1, +1] automatically. Normalising here would cause
    DOUBLE NORMALISATION and destroy the pretrained features.
"""
from __future__ import annotations
from pathlib import Path
from typing import List, Optional, Tuple
import tensorflow as tf

AUTOTUNE = tf.data.AUTOTUNE


def load_split(
    split_dir: Path, image_size: int = 224, batch_size: int = 32,
    seed: int = 42, class_names: Optional[List[str]] = None, shuffle: bool = False,
) -> tf.data.Dataset:
    """Load a single split (train/validation/test) from class sub-folders.

    Images are loaded as float32 in [0, 255] range by default from
    image_dataset_from_directory.  We keep them in this range -- the
    model's built-in Rescaling layer handles the [-1, +1] conversion
    that MobileNetV2 expects.
    """
    return tf.keras.utils.image_dataset_from_directory(
        str(split_dir), seed=seed, image_size=(image_size, image_size),
        batch_size=batch_size, label_mode="categorical",
        class_names=class_names, shuffle=shuffle,
    )


def build_pipeline(
    dataset: tf.data.Dataset, shuffle_buffer: int = 1000,
    seed: int = 42, training: bool = False,
) -> tf.data.Dataset:
    """Cache, shuffle (training only), and prefetch.

    NOTE: No normalisation here!  The model's Rescaling layer converts
    [0, 255] -> [-1, +1] inside the computation graph.  This ensures
    the same preprocessing runs during both training AND inference.
    """
    dataset = dataset.cache()
    if training:
        dataset = dataset.shuffle(shuffle_buffer, seed=seed)
    return dataset.prefetch(AUTOTUNE)


def load_all_datasets(
    data_dir: Path, image_size: int = 224, batch_size: int = 32,
    seed: int = 42, shuffle_buffer: int = 1000,
) -> Tuple[tf.data.Dataset, tf.data.Dataset, tf.data.Dataset, List[str]]:
    """Load and preprocess train, validation, and test splits.

    Returns: (train_ds, val_ds, test_ds, class_names)
    """
    train_dir = data_dir / "train"
    val_dir = data_dir / "validation"
    test_dir = data_dir / "test"

    for name, path in [("train", train_dir), ("validation", val_dir), ("test", test_dir)]:
        if not path.exists():
            raise FileNotFoundError(f"Missing '{name}' folder at {path}.")

    train_raw = load_split(train_dir, image_size, batch_size, seed, shuffle=True)
    class_names = train_raw.class_names
    print(f"\n[+] Discovered {len(class_names)} classes: {class_names}")

    val_raw = load_split(val_dir, image_size, batch_size, seed, class_names=class_names)
    test_raw = load_split(test_dir, image_size, batch_size, seed, class_names=class_names)

    train_ds = build_pipeline(train_raw, shuffle_buffer, seed, training=True)
    val_ds = build_pipeline(val_raw, shuffle_buffer, seed)
    test_ds = build_pipeline(test_raw, shuffle_buffer, seed)

    return train_ds, val_ds, test_ds, class_names
