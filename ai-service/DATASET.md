# PlantVillage Dataset Setup For AgroMind AI

This guide sets up PlantVillage professionally for model training. The goal is
to make the dataset repeatable, clean, and easy to audit.

## Recommended Folder Structure

Keep raw data separate from processed training data:

```text
ai-service/
  data/
    raw/
      plantvillage/
        Apple___Apple_scab/
        Apple___Black_rot/
        Apple___healthy/
        Tomato___Late_blight/
        Tomato___healthy/
        ...
    processed/
      plantvillage/
        train/
          Apple___Apple_scab/
          Tomato___healthy/
        validation/
          Apple___Apple_scab/
          Tomato___healthy/
        test/
          Apple___Apple_scab/
          Tomato___healthy/
        dataset_manifest.csv
        dataset_report.json
```

Raw data is the original download. Processed data is what AgroMind trains on.
This separation matters because you can rebuild the processed dataset any time
without losing the original images.

## Prepare The Dataset

Put the PlantVillage class folders in:

```text
ai-service/data/raw/plantvillage/
```

Your current project also has a local dataset folder at:

```text
ai-service/dataset/
```

You can use it directly. Because some folders use names like
`Tomato_Early_blight` instead of the preferred `Tomato___Early_blight`, use
`--normalize-labels` so the prepared output works cleanly with the serving API.

```powershell
.\.venv\Scripts\python.exe -m training.prepare_plantvillage --raw-dir dataset --output-dir data/processed/plantvillage --normalize-labels --clean
```

Then run from `ai-service`:

```powershell
.\.venv\Scripts\python.exe -m training.prepare_plantvillage --raw-dir data/raw/plantvillage --clean
```

This creates:

```text
data/processed/plantvillage/train
data/processed/plantvillage/validation
data/processed/plantvillage/test
```

Default split:

- 70% training
- 15% validation
- 15% test

Custom split:

```powershell
.\.venv\Scripts\python.exe -m training.prepare_plantvillage --raw-dir data/raw/plantvillage --train-ratio 0.8 --validation-ratio 0.1 --test-ratio 0.1 --clean
```

## What The Preparation Script Does

### Dataset Organization

The script preserves one folder per class. In TensorFlow, folder names become
class labels, so this structure is important:

```text
train/Tomato___Late_blight/image.jpg
train/Tomato___healthy/image.jpg
```

This tells TensorFlow that images in `Tomato___Late_blight` belong to one class
and images in `Tomato___healthy` belong to another.

### Multi-Crop Classification Labels

AgroMind uses multi-class classification: every crop-disease pair is one output
class. A model trained on five crops with eight diseases each has one softmax
output per crop-disease label, not just one output per disease.

Recommended label format:

```text
Crop___Disease_name
```

Examples:

```text
Apple___Apple_scab
Corn___Common_rust
Potato___Early_blight
Tomato___Late_blight
Tomato___healthy
```

This naming convention matters because the serving API parses labels into:

- crop category: Tomato, Apple, Corn, Potato
- disease name: Late Blight, Apple Scab, Common Rust
- disease category: healthy, fungal, bacterial, viral, unknown

The training pipeline writes `models/class_names.json` in the same order as the
model output neurons. Never reorder this file after training. If label order and
model output order drift apart, the API will return the wrong disease name even
when the model prediction is numerically correct.

If your downloaded dataset uses single underscores, such as
`Tomato_Early_blight`, the preparation script can convert it to
`Tomato___Early_blight` when you pass `--normalize-labels`.

### Scaling The Dataset

To add a new crop, add new class folders under the raw PlantVillage directory
and rerun preparation and training. Keep minimum image counts reasonably balanced
per class so the model does not overlearn common crops and underperform on rare
diseases.

Good dataset hygiene for scale:

- Keep one folder per crop-disease class.
- Keep healthy classes for every crop you support.
- Track class counts in `dataset_report.json`.
- Add real field images over time, not only clean lab-style images.
- Retrain and evaluate with the same `class_names.json` used by serving.

### Training, Validation, And Test Split

The split is fixed with a random seed, default `42`.

- Training data teaches the model.
- Validation data checks progress during training.
- Test data is held back until the end and gives the most honest final score.

Keeping test data separate is a production habit. If you tune your model against
the test set, the score stops being trustworthy.

### Data Preprocessing

The script verifies every image can be opened, fixes EXIF orientation, converts
to RGB, center-crops to a square, resizes to `224x224`, and saves a clean JPEG.

Why `224x224`? MobileNetV2 was designed to work well at this size, and the
FastAPI prediction service already resizes uploaded images to the same shape.

The reusable TensorFlow preprocessing pipeline is documented in:

```text
ai-service/DATA_PREPROCESSING_PIPELINE.md
ai-service/PREPROCESSING.md
```

### Image Resizing

Images from different sources have different dimensions. A neural network needs
a consistent input tensor, so every image becomes:

```text
224 x 224 x 3
```

That means width 224, height 224, and 3 RGB color channels.

### Data Augmentation

Augmentation is applied during training, not during dataset preparation. The
training model randomly applies:

- Horizontal flips
- Small rotations
- Small zooms
- Contrast changes

This helps the model handle real phone photos where leaves are not perfectly
centered, lighting varies, and the plant may be rotated.

## Why Clean Datasets Matter

A model learns whatever patterns exist in the dataset. If the dataset is messy,
the model learns messy shortcuts.

Clean datasets help because:

- Broken images do not crash training halfway through.
- Fixed image size keeps training stable and faster.
- Separate test data gives honest accuracy.
- Class folders prevent label mix-ups.
- A manifest lets you audit exactly which image went into which split.
- Reproducible splits make experiments comparable.

PlantVillage is useful, but it is cleaner than real farm photos. For a stronger
AgroMind production model, later add field images from real users and retrain or
fine-tune with those images.

## Output Files

`dataset_manifest.csv` records every prepared image:

```text
split,class_name,source_path,prepared_path,original_width,original_height,prepared_width,prepared_height
```

`dataset_report.json` records:

- Split ratios
- Image size
- Total class count
- Total prepared images
- Per-class image counts
- Skipped/broken images

These files are boring in the best way: they make the dataset accountable.

## Train With The Prepared Dataset

After preparation:

```powershell
.\.venv\Scripts\python.exe -m training.train_mobilenetv2 --data-dir data/processed/plantvillage
```

The trained model will be saved to:

```text
models/leaf_disease_model.keras
```
