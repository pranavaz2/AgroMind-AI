# AgroMind Production Training Pipeline

This guide explains the end-to-end TensorFlow training pipeline for AgroMind AI.
It starts from the raw dataset in:

```text
ai-service/dataset/
```

and produces a trained MobileNetV2 plant disease model that the FastAPI AI
service can load.

## One Command

From `ai-service`:

```powershell
.\.venv\Scripts\python.exe -m training.run_training_pipeline --raw-dir dataset --output-dir models --head-epochs 15 --fine-tune-epochs 15 --batch-size 32
```

For a quick smoke test:

```powershell
.\.venv\Scripts\python.exe -m training.run_training_pipeline --raw-dir dataset --output-dir models/_smoke_pipeline --head-epochs 1 --fine-tune-epochs 0 --batch-size 64
```

## What The Pipeline Does

1. Reads class folders from `dataset/`.
2. Normalizes labels like `Tomato_Early_blight` into
   `Tomato___Early_blight`.
3. Splits images into training, validation, and test folders.
4. Resizes images to `224x224`.
5. Builds TensorFlow `tf.data` datasets.
6. Normalizes pixels from `0..255` to `0..1`.
7. Applies training-time image augmentation.
8. Builds a MobileNetV2 transfer-learning model.
9. Trains the new classification head.
10. Fine-tunes the upper MobileNetV2 layers.
11. Saves the best validation checkpoint.
12. Evaluates on the held-out test set.
13. Saves the final `.keras` model and production metadata.

## Output Artifacts

The pipeline saves:

```text
models/
  leaf_disease_model.keras
  class_names.json
  raw_class_names.json
  model_metadata.json
  evaluation.json
  evaluation_detailed.json
  classification_report.csv
  confusion_matrix.csv
  training_history.csv
  pipeline_summary.json
  checkpoints/best_model.keras
  logs/
```

These files are useful for serving, debugging, and comparing experiments.

## Transfer Learning

Transfer learning means AgroMind does not start from a blank model.

MobileNetV2 is first loaded with ImageNet weights. Those weights already know
general visual patterns such as edges, colors, textures, spots, and shapes. The
training pipeline reuses that visual knowledge and teaches a new classifier to
map leaf images to plant disease classes.

The pipeline trains in two stages:

- Stage 1: MobileNetV2 is frozen. Only the new AgroMind classification head
  learns.
- Stage 2: The upper MobileNetV2 layers are unfrozen and fine-tuned with a very
  small learning rate.

This is usually faster and more accurate than training a CNN from scratch.

## Epochs

An epoch is one full pass through the training dataset.

If the train split has 3,955 images and the batch size is 32, one epoch means
the model has seen all 3,955 training images once, grouped into many batches.

More epochs give the model more chances to learn, but too many epochs can cause
overfitting.

## Batches

A batch is a small group of images processed together.

For example:

```text
batch_size = 32
```

means TensorFlow updates the model after looking at 32 images at a time.

Small batches use less memory. Larger batches can be faster but may need more
RAM or GPU memory.

## Validation

Validation data is not used to update model weights. It is used after each epoch
to answer:

```text
Is the model improving on images it did not train on?
```

Training accuracy tells you how well the model fits the training images.
Validation accuracy tells you whether it is learning patterns that generalize.

## Callbacks

Callbacks are tools that run during training.

AgroMind uses:

- `ModelCheckpoint`: saves the best model based on validation accuracy.
- `EarlyStopping`: stops training when validation loss stops improving.
- `ReduceLROnPlateau`: lowers the learning rate when progress slows.
- `CSVLogger`: writes epoch metrics to `training_history.csv`.
- `TensorBoard`: writes logs for visual training charts.

Callbacks make training safer because they protect the best model and reduce
wasted epochs.

## Model Evaluation

After training, the pipeline loads the best validation checkpoint and evaluates
it on the test set.

The test set is held back until the end. That gives a more honest estimate of
real model quality.

Metrics include:

- Accuracy
- Top-3 accuracy
- Precision
- Recall
- F1 score
- Confusion matrix

## Production Notes

- Keep `class_names.json` with the model. It defines the output neuron order.
- Use the same `IMAGE_SIZE` in training and FastAPI serving.
- Do not judge production quality from PlantVillage alone; add real field
  images when AgroMind users start uploading scans.
- For real deployment, point `.env` at the final model and set
  `ENABLE_DEMO_FALLBACK=false`.
