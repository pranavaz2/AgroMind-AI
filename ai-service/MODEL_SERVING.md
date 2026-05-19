# AgroMind TensorFlow Model Serving

This guide explains how AgroMind saves trained TensorFlow models and loads them
for efficient production predictions.

For the shortest practical save/load/predict walkthrough, also see:

```text
ai-service/PREDICTION_PIPELINE.md
```

## Model Serialization

Model serialization means turning a trained model into files on disk so it can
be loaded later without retraining.

AgroMind saves the final trained model here:

```text
ai-service/models/leaf_disease_model.keras
```

The `.keras` format stores:

- The model architecture.
- The trained weights.
- The layer configuration needed to rebuild the model.

AgroMind also saves sidecar files:

```text
models/class_names.json
models/raw_class_names.json
models/model_metadata.json
models/evaluation.json
models/evaluation_detailed.json
```

The sidecar files are important because the model output is just numbers. For
example, output neuron `0` only becomes meaningful when `class_names.json` says
it means `Tomato - Late blight`.

## Saving The Model

The training script saves the production model at the end of training:

```powershell
.\.venv\Scripts\python.exe -m training.train_mobilenetv2 --data-dir data/processed/plantvillage
```

The final save uses:

```python
model.save("models/leaf_disease_model.keras", include_optimizer=False)
```

`include_optimizer=False` keeps the inference artifact smaller because the API
does not need optimizer state. Optimizer state is useful for resuming training,
not for predicting leaf disease.

Validation checkpoints are still saved during training:

```text
models/checkpoints/best_model.keras
```

Use checkpoints for experiment recovery. Use `leaf_disease_model.keras` for the
API.

## Model Metadata

`model_metadata.json` records the contract between training and serving:

- Image input size.
- Input tensor shape.
- Pixel value range.
- Class order.
- TensorFlow version.
- Training config.
- Final evaluation metrics.

This prevents a common production problem: loading a good model with the wrong
labels or wrong image size.

## Loading The Model For Predictions

The FastAPI service loads the TensorFlow model once during application startup:

```text
app/main.py -> lifespan() -> get_leaf_model()
```

The dependency layer keeps one cached model instance:

```text
app/core/dependencies.py -> get_leaf_model()
```

The model adapter lives in:

```text
app/model/tensorflow_model.py
```

It loads with:

```python
tf.keras.models.load_model(model_path, compile=False)
```

`compile=False` is the right choice for inference. The API is not training, so
it does not need loss functions, optimizers, or training metrics loaded into the
runtime.

The same adapter can also load `.tflite` artifacts with a TensorFlow Lite
interpreter. Set `AI_MODEL_PATH` to a TFLite file when you want smaller model
size or faster CPU/mobile-style inference:

```env
AI_MODEL_PATH=models/optimized/leaf_disease_dynamic.tflite
```

## Efficient Inference

Inference means running a trained model on new input data to get predictions.

AgroMind keeps inference efficient by:

- Loading the model once at startup, not per request.
- Loading with `compile=False`.
- Creating a `tf.function` inference callable.
- Supporting TensorFlow Lite interpreter reuse for optimized artifacts.
- Running a warmup prediction at startup.
- Sending already-normalized `float32` batches to the model.

Warmup matters because TensorFlow may do graph setup work the first time a model
is called. AgroMind does that with a dummy image so the first real farmer upload
is faster.

Runtime setting:

```env
ENABLE_MODEL_WARMUP=true
```

## Prediction Pipeline

The production prediction path is:

```text
Mobile app / Node backend
  -> POST /api/v1/predictions/leaf-disease
  -> FastAPI route
  -> upload validation
  -> Pillow image loading
  -> EXIF orientation fix
  -> RGB conversion
  -> center crop
  -> 224x224 resize
  -> float32 normalization to 0..1
  -> batch shape: 1 x 224 x 224 x 3
  -> TensorFlow inference
  -> softmax probabilities
  -> top predictions
  -> farmer-friendly advice
```

The API returns the best prediction and up to five ranked predictions:

```json
{
  "crop_name": "Tomato",
  "crop_category": "fungal",
  "disease_name": "Late Blight",
  "confidence_score": 0.91,
  "severity": "needs_attention",
  "treatment_suggestion": "For Tomato, the model detected Late Blight. Remove badly infected leaves and avoid overhead irrigation. Confirm locally before applying chemical treatment.",
  "prediction": {
    "label": "Tomato - Late blight",
    "confidence": 0.91,
    "crop_name": "Tomato",
    "disease_name": "Late Blight",
    "category": "fungal",
    "is_healthy": false
  },
  "top_predictions": [
    { "label": "Tomato - Late blight", "confidence": 0.91 },
    { "label": "Tomato - healthy", "confidence": 0.04 }
  ]
}
```

## Multi-Crop Serving

The serving layer supports one scalable multi-class model where each output
neuron represents a crop-disease pair:

```text
Tomato___Late_blight
Apple___Apple_scab
Corn___Common_rust
Potato___healthy
```

`app/model/label_metadata.py` parses those labels into crop name, disease name,
healthy status, and disease category. `app/services/treatment_knowledge.py` then
uses that metadata to choose crop-specific treatment suggestions with generic
category fallbacks for new crops.

## Production Settings

Use these settings for real deployments:

```env
AI_MODEL_PATH=models/leaf_disease_model.keras
AI_CLASS_NAMES_PATH=models/class_names.json
AI_MODEL_METADATA_PATH=models/model_metadata.json
IMAGE_SIZE=224
ENABLE_MODEL_WARMUP=true
ENABLE_DEMO_FALLBACK=false
```

For optimized serving:

```env
AI_MODEL_PATH=models/optimized/leaf_disease_dynamic.tflite
```

`ENABLE_DEMO_FALLBACK=false` is important. It makes the API fail with `503` if
the real model is missing instead of returning demo predictions.

## Health Check

Check model status with:

```http
GET /api/v1/health
```

The response includes:

- Whether the model is loaded.
- The configured model path.
- Any model load error.
- Class count.
- Model metadata.

If `model_loaded` is `false`, check:

- Does `AI_MODEL_PATH` point to the trained `.keras` file?
- Does `AI_CLASS_NAMES_PATH` point to the matching class names JSON?
- Was the model trained with the same `IMAGE_SIZE` used by the API?

## Architecture Summary

AgroMind uses a layered serving architecture:

- `routes`: HTTP request and response handling.
- `services`: prediction workflow and farmer advice.
- `utils`: image validation and preprocessing.
- `model`: TensorFlow loading and inference.
- `core`: settings and dependency wiring.

This keeps TensorFlow concerns isolated. The rest of the app does not need to
know whether the model is `.keras`, SavedModel, or another TensorFlow artifact
later.
