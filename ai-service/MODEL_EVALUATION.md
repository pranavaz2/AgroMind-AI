# AgroMind Model Evaluation

This guide explains how to evaluate the AgroMind plant disease model after
training and how to read the files written to `ai-service/models/`.

## Run Evaluation

Evaluation runs automatically at the end of training:

```powershell
.\.venv\Scripts\python.exe -m training.train_mobilenetv2 --data-dir data/processed/plantvillage
```

For a quick smoke check with the tiny local sample dataset:

```powershell
.\.venv\Scripts\python.exe -m training.train_mobilenetv2 --data-dir data/_smoke/processed --output-dir models/_smoke --weights none --head-epochs 1 --fine-tune-epochs 0 --batch-size 4
```

The smoke command only proves the pipeline works. It is not a meaningful model
quality result because the dataset is tiny.

## Evaluation Outputs

Training writes these files:

```text
models/
  evaluation.json
  evaluation_detailed.json
  classification_report.csv
  confusion_matrix.csv
  training_history.csv
```

`evaluation.json` contains the main held-out test metrics:

- `loss`: how wrong the model was on the test set. Lower is better.
- `accuracy`: the exact top-1 classification accuracy.
- `top_3_accuracy`: how often the correct answer was in the top 3 predictions.

`evaluation_detailed.json` contains everything needed for audit or debugging:

- Main metrics.
- Display class names.
- Per-class precision, recall, F1 score, and support.
- Confusion matrix.
- Per-sample predicted probabilities.

`classification_report.csv` is a spreadsheet-friendly view of per-class scores.

`confusion_matrix.csv` shows which classes are being confused with each other.
Rows are actual labels. Columns are predicted labels.

## How To Read The Metrics

Accuracy is useful, but it can hide weak classes. Always inspect per-class
metrics too.

- Precision answers: "When the model predicts this class, how often is it right?"
- Recall answers: "Of all real examples of this class, how many did it catch?"
- F1 score balances precision and recall.
- Support is the number of test images for that class.

For disease detection, low recall on a serious disease is usually more risky
than low precision. Low recall means the model misses true cases.

## How To Read The Confusion Matrix

Open `confusion_matrix.csv`.

Example shape:

```text
actual\predicted,Tomato - healthy,Tomato - Late blight
Tomato - healthy,120,8
Tomato - Late blight,11,115
```

The diagonal numbers are correct predictions. Off-diagonal numbers are mistakes.
In this example:

- 120 healthy leaves were correctly predicted as healthy.
- 8 healthy leaves were incorrectly predicted as late blight.
- 11 late blight leaves were incorrectly predicted as healthy.
- 115 late blight leaves were correctly predicted as late blight.

The most important mistakes are disease images predicted as healthy, because a
farmer may delay treatment.

## Minimum Bar For A Demo

For a classroom or prototype demo, aim for:

- Test accuracy above 85% on PlantVillage.
- Top-3 accuracy above 95%.
- No severe disease class with very low recall.
- API response shows `"model_loaded": true`.

For production, PlantVillage alone is not enough. Test and fine-tune with real
field images from phones, including blur, shadows, backgrounds, multiple leaves,
and local crop varieties.

## Common Problems

### High Training Accuracy, Low Validation Accuracy

The model is overfitting. Try:

- More real images.
- Stronger data augmentation.
- Fewer fine-tuning epochs.
- Lower fine-tuning learning rate.

### Good Overall Accuracy, Bad Disease Recall

The dataset may be imbalanced or the disease class may be visually similar to
another class. Add more examples for the weak class and inspect the confusion
matrix.

### API Predicts The Wrong Labels

Check that `models/class_names.json` was saved by the same training run as
`models/leaf_disease_model.keras`. The label order must match the model output
order exactly.

### Model Missing In The API

If `/api/v1/health` shows `"model_loaded": false`, verify:

```text
AI_MODEL_PATH=models/leaf_disease_model.keras
AI_CLASS_NAMES_PATH=models/class_names.json
```

For production, keep:

```text
ENABLE_DEMO_FALLBACK=false
```

That prevents demo predictions when the trained model is missing.
