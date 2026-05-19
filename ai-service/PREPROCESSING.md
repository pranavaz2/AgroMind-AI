# AgroMind Image Preprocessing Pipeline

This document explains how AgroMind converts plant leaf photos into tensors that
TensorFlow can train on and predict from.

## What Image Preprocessing Means

Raw photos are not ready for a neural network. They can have different sizes,
file formats, color modes, camera orientations, and pixel ranges.

Preprocessing makes every image consistent:

```text
raw image file
  -> valid readable image
  -> correct orientation
  -> RGB color
  -> square crop
  -> 224x224 resize
  -> float32 tensor
  -> normalized pixels
  -> batch tensor
```

For AgroMind, the final input shape is:

```text
batch_size x 224 x 224 x 3
```

The `3` means RGB channels: red, green, and blue.

## Training Preprocessing

The TensorFlow dataset pipeline lives in:

```text
ai-service/training/preprocessing_pipeline.py
```

The trainer loads images from prepared folders:

```text
data/processed/plantvillage/train
data/processed/plantvillage/validation
data/processed/plantvillage/test
```

Then it applies:

- Tensor conversion through `image_dataset_from_directory`
- Batch loading
- `float32` conversion
- Normalization from `0..255` to `0..1`
- Training-only shuffling
- Cache
- Prefetch

## Prediction Preprocessing

The API upload pipeline lives in:

```text
ai-service/app/utils/image_preprocessing.py
```

It does the same important shape work as training:

- Validates file type and size
- Reads JPEG, PNG, WebP, HEIC, or HEIF
- Fixes EXIF orientation
- Converts to RGB
- Center-crops and resizes to `224x224`
- Converts to NumPy `float32`
- Normalizes pixels to `0..1`
- Adds a batch dimension

That last step changes one image from:

```text
224 x 224 x 3
```

to:

```text
1 x 224 x 224 x 3
```

TensorFlow models expect batches, even when the batch contains one image.

## Normalization

Images usually load with pixel values from `0` to `255`.

Example:

```text
0   = black
255 = full brightness
```

The pipeline converts those values into `0..1`:

```python
image = tf.cast(image, tf.float32) / 255.0
```

This helps training because neural networks learn more smoothly when inputs are
small, consistent numbers.

MobileNetV2 then gets another model-internal rescaling step:

```text
0..1 -> -1..1
```

That is the range MobileNetV2 was originally designed to use. Keeping this step
inside the saved model prevents mistakes during API inference.

## Tensor Conversion

A tensor is a multi-dimensional numeric array. For images:

```text
height x width x channels
```

For batches:

```text
batch x height x width x channels
```

AgroMind uses:

```text
float32 tensors
```

because TensorFlow models train and predict efficiently with that numeric type.

## Image Resizing

MobileNetV2 works well with `224x224` images. Resizing gives every batch a fixed
shape, which is required for efficient GPU/CPU training.

The dataset preparation step writes resized JPEGs to disk. The API prediction
step also resizes uploaded photos at request time. Keeping both paths aligned
reduces train/serve mismatch.

## Batch Processing

Instead of training on one image at a time, TensorFlow trains on batches:

```text
32 images -> one batch -> one model update
```

Batches make training faster and make gradients more stable than single-image
updates.

The default batch size is `32`. If your computer runs out of memory, lower it:

```powershell
.\.venv\Scripts\python.exe -m training.train_mobilenetv2 --data-dir data/processed/plantvillage --batch-size 16
```

## Data Augmentation

Augmentation creates realistic variations during training:

- Horizontal flips
- Small rotations
- Small zooms
- Contrast changes

Augmentation is not applied to validation, test, or API prediction. Those paths
should measure or infer from the real image, not a randomized version of it.

## Performance Optimization

The preprocessing pipeline uses `tf.data` performance features:

### Parallel Mapping

```python
dataset.map(..., num_parallel_calls=tf.data.AUTOTUNE)
```

TensorFlow chooses a good level of parallel CPU work.

### Cache

```python
dataset.cache()
```

Deterministic preprocessing is kept in memory after the first pass, so later
epochs do less repeated work.

### Prefetch

```python
dataset.prefetch(tf.data.AUTOTUNE)
```

While the model trains on one batch, TensorFlow prepares the next batch in the
background. This keeps the model from waiting on image loading.

### Prepared Images On Disk

The `prepare_plantvillage.py` script resizes and cleans images once before
training. That removes repeated JPEG decoding and resizing decisions from the
main training loop.

## Why This Matters

Good preprocessing improves:

- Accuracy, because inputs are consistent.
- Training speed, because batches are ready efficiently.
- Reliability, because broken images are caught early.
- Deployment safety, because training and API inference use the same image size
  and normalization assumptions.
