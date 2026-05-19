"""TensorFlow preprocessing pipeline for AgroMind image datasets."""

from __future__ import annotations

from dataclasses import dataclass

import tensorflow as tf
from tensorflow.keras import layers


AUTOTUNE = tf.data.AUTOTUNE


@dataclass(frozen=True)
class ImagePipelineConfig:
    image_size: int = 224
    shuffle_buffer_size: int = 1000
    cache: bool = True
    normalize: bool = True
    augment: bool = False
    seed: int = 42


def normalize_images(images: tf.Tensor, labels: tf.Tensor) -> tuple[tf.Tensor, tf.Tensor]:
    """Convert image pixels from uint8 0..255 into float32 0..1 tensors."""

    images = tf.cast(images, tf.float32) / 255.0
    return images, labels


def make_augmentation_layer() -> tf.keras.Sequential:
    """Create advanced training augmentation for robust leaf-photo variation."""
    return tf.keras.Sequential(
        [
            layers.RandomFlip("horizontal_and_vertical"),
            layers.RandomTranslation(height_factor=0.1, width_factor=0.1),
            layers.RandomRotation(0.15),
            layers.RandomZoom(0.15),
            layers.RandomContrast(0.15),
            layers.RandomBrightness(0.15),
        ],
        name="data_augmentation",
    )


def augment_images(
    images: tf.Tensor,
    labels: tf.Tensor,
    augmentation: tf.keras.Sequential,
) -> tuple[tf.Tensor, tf.Tensor]:
    """Apply random image transforms only to training batches."""

    return augmentation(images, training=True), labels


def preprocess_dataset(
    dataset: tf.data.Dataset,
    config: ImagePipelineConfig,
    training: bool = False,
) -> tf.data.Dataset:
    """Build an efficient tf.data pipeline for image classification.

    The order is deliberate:
    1. Normalize tensors with parallel mapping.
    2. Cache deterministic preprocessing.
    3. Shuffle only training data.
    4. Optionally apply random augmentation only to training data.
    5. Batch work is prefetched so CPU preprocessing overlaps model training.

    The MobileNetV2 training script keeps augmentation inside the model so the
    saved architecture documents the training-time transforms. This function
    also supports dataset-level augmentation for experiments and notebooks.
    """

    if config.normalize:
        dataset = dataset.map(normalize_images, num_parallel_calls=AUTOTUNE)

    if config.cache:
        dataset = dataset.cache()

    if training:
        dataset = dataset.shuffle(config.shuffle_buffer_size, seed=config.seed)
        if config.augment:
            augmentation = make_augmentation_layer()
            dataset = dataset.map(
                lambda images, labels: augment_images(images, labels, augmentation),
                num_parallel_calls=AUTOTUNE,
            )

    return dataset.prefetch(AUTOTUNE)
