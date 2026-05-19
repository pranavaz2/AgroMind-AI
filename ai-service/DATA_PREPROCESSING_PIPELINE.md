# AgroMind Dataset Preprocessing Pipeline

This guide explains the professional preprocessing pipeline for the PlantVillage
dataset in:

```text
ai-service/dataset/
```

The goal is to turn raw class folders into clean TensorFlow-ready training,
validation, and test datasets.

## Run The Pipeline

From `ai-service`:

```powershell
.\.venv\Scripts\python.exe -m training.prepare_plantvillage --raw-dir dataset --output-dir data/processed/plantvillage --normalize-labels --clean
```

Output:

```text
data/processed/plantvillage/
  train/
  validation/
  test/
  dataset_manifest.csv
  dataset_report.json
```

Default split:

- 70% training
- 15% validation
- 15% test

For a custom split:

```powershell
.\.venv\Scripts\python.exe -m training.prepare_plantvillage --raw-dir dataset --output-dir data/processed/plantvillage --train-ratio 0.8 --validation-ratio 0.1 --test-ratio 0.1 --normalize-labels --clean
```

## What Preprocessing Means

Preprocessing means converting messy real files into consistent model input.
For AgroMind, that means every leaf image becomes:

```text
224 x 224 x 3 RGB
```

The script in `training/prepare_plantvillage.py`:

- Finds one folder per disease class.
- Validates that images can be opened.
- Fixes phone/camera orientation using EXIF metadata.
- Converts images to RGB.
- Center-crops and resizes images to `224x224`.
- Saves clean JPEG files.
- Splits data into train, validation, and test folders.
- Writes `dataset_manifest.csv` for auditability.
- Writes `dataset_report.json` with class counts and skipped files.

## Normalization

Normalization means scaling pixel values into a range the neural network can
learn from smoothly.

Images start as integer pixels:

```text
0..255
```

The TensorFlow preprocessing pipeline in `training/preprocessing_pipeline.py`
converts them to:

```text
0.0..1.0
```

That happens here:

```python
images = tf.cast(images, tf.float32) / 255.0
```

MobileNetV2 training then rescales `0..1` into `-1..1` inside the model before
the pretrained base network sees the image.

## Data Augmentation

Augmentation creates random variations of training images so the model learns
general disease patterns instead of memorizing exact photos.

AgroMind uses:

- Horizontal and vertical flips
- Small translations
- Small rotations
- Small zooms
- Contrast changes
- Brightness changes

Important: augmentation is only for training images. Validation and test images
must stay unchanged so the metrics stay honest.

The reusable augmentation layer lives in:

```text
training/preprocessing_pipeline.py
```

The MobileNetV2 trainer uses the same augmentation layer inside the model, so
the training architecture clearly records which transforms were used.

## Train, Validation, And Test Split

The dataset is split into three parts:

- Training data teaches the model.
- Validation data checks progress during training.
- Test data is saved for the final honest score.

Why this matters:

- If you train and test on the same images, accuracy looks better than reality.
- Validation helps detect overfitting while training.
- Test data tells you how the model performs on unseen examples.

The split uses a fixed random seed, so you can rerun the pipeline and get the
same split again.

## TensorFlow Preprocessing Pipeline

The TensorFlow pipeline is in:

```text
training/preprocessing_pipeline.py
```

It provides:

- `ImagePipelineConfig`: preprocessing settings.
- `normalize_images`: converts pixels to float32 `0..1`.
- `make_augmentation_layer`: creates random training transforms.
- `preprocess_dataset`: builds an efficient `tf.data` pipeline.

The pipeline uses:

- `map` for parallel preprocessing.
- `cache` for deterministic preprocessing speed.
- `shuffle` for training batches.
- `prefetch` so CPU image work overlaps GPU/CPU model training.

## Why Preprocessing Matters

Preprocessing matters because AI models are sensitive to inconsistent input.
Without preprocessing:

- Different image sizes can break training.
- Rotated images confuse the model.
- Broken files can crash long training runs.
- Unnormalized pixels make optimization harder.
- Label naming issues can make the API return confusing disease names.
- Bad train/test splitting can create fake accuracy.

Clean preprocessing makes the model easier to train, evaluate, debug, and serve
through the FastAPI prediction API.

## Next Step

After preprocessing, train the model:

```powershell
.\.venv\Scripts\python.exe -m training.train_mobilenetv2 --data-dir data/processed/plantvillage --output-dir models --head-epochs 15 --fine-tune-epochs 15 --batch-size 32
```
