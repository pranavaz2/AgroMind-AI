# AgroMind Plant Disease Model Training

This guide trains a real TensorFlow plant disease model for AgroMind AI using
MobileNetV2 transfer learning and the PlantVillage dataset.

## What You Are Building

The model receives a leaf image and returns a probability for each disease
class. The FastAPI prediction service then turns those probabilities into a
farmer-friendly response.

The training script saves:

- `models/leaf_disease_model.keras`: the trained TensorFlow model.
- `models/class_names.json`: readable labels in the exact output order.
- `models/raw_class_names.json`: original PlantVillage folder labels.
- `models/model_metadata.json`: serving contract for input shape, label order,
  training config, and evaluation metrics.
- `models/evaluation.json`: final test metrics.
- `models/evaluation_detailed.json`: per-class metrics, confusion matrix, and
  per-sample probabilities.
- `models/classification_report.csv`: spreadsheet-friendly precision, recall,
  F1 score, and support.
- `models/confusion_matrix.csv`: actual-vs-predicted class counts.
- `models/training_history.csv`: epoch-by-epoch accuracy and loss.
- `models/checkpoints/best_model.keras`: best validation checkpoint.
- `models/logs/...`: TensorBoard logs.

## Beginner Concepts

### CNN Basics

A convolutional neural network, or CNN, is a model built for images. It learns
small visual patterns first, such as edges and spots. Deeper layers combine
those patterns into bigger ideas, such as leaf texture, yellowing, brown
patches, or disease-shaped lesions.

### Transfer Learning

Training a large CNN from scratch needs a lot of images and compute. Transfer
learning starts from a model that already learned general image features. We
reuse those visual skills and train a smaller classification head for plant
diseases.

### MobileNetV2

MobileNetV2 is a lightweight CNN architecture. It is much smaller than many
classic image models, so it is a good fit for AgroMind because it can run faster
and can later be converted for mobile or edge deployment.

### Training Process

Training means showing the model labeled images many times. Each pass through
the dataset is called an epoch. The model predicts a class, compares it with the
correct class, calculates loss, and updates its weights to reduce future errors.

This pipeline trains in two stages:

1. Frozen base: MobileNetV2 stays frozen and only the new disease classifier
   head learns.
2. Fine-tuning: the upper MobileNetV2 layers are unfrozen and gently adjusted
   with a very small learning rate.

### Validation

Validation data is data the model sees during evaluation, not weight updates.
It answers: "Is the model improving on images it is not directly training on?"

### Overfitting

Overfitting happens when training accuracy keeps improving but validation
accuracy stops improving or gets worse. The model has started memorizing the
training images instead of learning general disease patterns.

This pipeline reduces overfitting with:

- Data augmentation: random flips, rotations, zooms, and contrast changes.
- Dropout: randomly hides some features while training.
- Label smoothing: stops the model from becoming too overconfident.
- Class weights: helps rare classes matter more during training.
- Early stopping: stops when validation loss stops improving.
- Validation checkpoints: keeps the best validation model.

## PlantVillage Dataset Layout

First prepare the dataset with the professional setup guide:

```text
ai-service/DATASET.md
```

The training script expects:

```text
ai-service/data/processed/plantvillage/
  train/
    Apple___Apple_scab/
    Tomato___healthy/
  validation/
    Apple___Apple_scab/
    Tomato___healthy/
  test/
    Apple___Apple_scab/
    Tomato___healthy/
```

Each subfolder name becomes one class label. The script saves those labels to
`models/class_names.json` in a readable form, and the FastAPI service reads that
file automatically.

## Setup

From the `ai-service` folder:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

If PowerShell blocks activation scripts, use:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Train

From `ai-service`:

For the full production pipeline, use:

```powershell
.\.venv\Scripts\python.exe -m training.run_training_pipeline --raw-dir dataset --output-dir models --head-epochs 15 --fine-tune-epochs 15 --batch-size 32
```

More detail is documented in:

```text
ai-service/TRAINING_PIPELINE.md
```

If you are using the local `ai-service/dataset/` folder in this project, prepare
it first:

```powershell
.\.venv\Scripts\python.exe -m training.prepare_plantvillage --raw-dir dataset --output-dir data/processed/plantvillage --normalize-labels --clean
```

Then train:

```powershell
.\.venv\Scripts\python.exe -m training.train_mobilenetv2 --data-dir data/processed/plantvillage
```

For a quicker first test:

```powershell
.\.venv\Scripts\python.exe -m training.train_mobilenetv2 --data-dir data/processed/plantvillage --head-epochs 2 --fine-tune-epochs 1
```

`--weights imagenet` is the default and gives real transfer learning. It may
download MobileNetV2 weights on the first run. Use `--weights none` only for
offline smoke tests, because that trains from scratch and usually performs much
worse.

For stronger training:

```powershell
.\.venv\Scripts\python.exe -m training.train_mobilenetv2 --data-dir data/processed/plantvillage --head-epochs 15 --fine-tune-epochs 15 --batch-size 32
```

Useful production options:

```powershell
.\.venv\Scripts\python.exe -m training.train_mobilenetv2 --data-dir data/processed/plantvillage --head-epochs 20 --fine-tune-epochs 20 --dropout 0.35 --label-smoothing 0.05 --batch-size 32
```

By default, the script uses class weights so smaller classes are not ignored.
Disable that only for controlled experiments:

```powershell
.\.venv\Scripts\python.exe -m training.train_mobilenetv2 --data-dir data/processed/plantvillage --no-class-weights
```

## Validate The Saved Model

After training, start the API:

```powershell
.\.venv\Scripts\python.exe run.py
```

Open:

```text
http://localhost:8000/docs
```

Upload a leaf image to:

```text
POST /api/v1/predictions/leaf-disease
```

The response should show `"model_loaded": true`.

For detailed model-quality review, see:

```text
ai-service/MODEL_EVALUATION.md
```

For professional save/load and inference architecture, see:

```text
ai-service/MODEL_SERVING.md
```

## Metrics To Watch

- `accuracy`: percentage of images classified correctly.
- `top_3_accuracy`: percentage where the correct class appears in the top 3.
- `loss`: how wrong the model is; lower is better.
- `val_accuracy`: accuracy on validation data.
- `val_loss`: loss on validation data.
- `precision`: when the model predicts a class, how often it is right.
- `recall`: for all real images of a class, how many the model finds.
- `f1_score`: balance between precision and recall.

Healthy training usually shows training and validation accuracy rising together.
If training accuracy is high but validation accuracy is much lower, collect more
varied images, increase augmentation, reduce fine-tuning epochs, or lower the
learning rate.

The final saved model is loaded from the best validation checkpoint before test
evaluation. That means `models/leaf_disease_model.keras` represents the best
validation model, not simply the last epoch that happened to run.

## Production Notes

PlantVillage images are clean, centered, and often photographed in lab-like
conditions. Real farmer photos have shadows, soil, hands, multiple leaves,
motion blur, and different phone cameras. For production quality, fine-tune this
model again with real AgroMind field images once you collect them.

For production deployments:

- Set `ENABLE_DEMO_FALLBACK=false`.
- Keep `AI_MODEL_PATH=models/leaf_disease_model.keras`.
- Keep `AI_CLASS_NAMES_PATH=models/class_names.json`.
- Retrain when you add new crops or disease classes.
- Test with real field images, not only PlantVillage validation images.
