# AgroMind AI Microservice Guide

This service is a small Python API whose only job is AI prediction. The mobile
app or Node.js backend sends a leaf photo to FastAPI, FastAPI prepares the image,
TensorFlow predicts the disease class, and the API returns clean JSON.

## What Is An AI Microservice?

An AI microservice is a separate backend service for machine-learning work.
AgroMind uses Python here because TensorFlow, Pillow, and NumPy are strongest in
the Python ecosystem.

Keeping AI separate has practical benefits:

- The Node.js backend can focus on users, farms, auth, posts, and scan history.
- The Python service can focus on image preprocessing and TensorFlow inference.
- The AI service can later run on a GPU server without moving the whole backend.
- Model updates can be deployed independently from normal app features.

## FastAPI Basics

FastAPI turns Python functions into REST endpoints.

The prediction route is in:

```text
app/routes/prediction_routes.py
```

The important line is:

```python
@router.post("/leaf-disease")
```

Because this router is mounted with `/api/v1/predictions`, the final endpoint is:

```http
POST /api/v1/predictions/leaf-disease
```

FastAPI also creates interactive docs automatically:

```text
http://localhost:8000/docs
```

## Project Architecture

```text
app/
  main.py                  # Creates FastAPI app and mounts routes
  core/
    config.py              # Environment variables and runtime settings
    dependencies.py        # Shared model/service dependencies
  routes/
    health_routes.py       # Health check endpoint
    prediction_routes.py   # Image upload prediction endpoint
  services/
    prediction_service.py  # Full prediction workflow
    treatment_knowledge.py # Farmer-friendly treatment advice
  model/
    tensorflow_model.py    # Loads .keras or .tflite models and runs inference
    label_metadata.py      # Converts raw class labels into crop/disease fields
  utils/
    image_preprocessing.py # File validation, Pillow loading, NumPy preprocessing
  schemas/
    prediction.py          # Pydantic response contracts
```

This layered structure keeps the code scalable. Routes handle HTTP, services
handle business flow, model code handles TensorFlow, utils handle image details,
and schemas define the JSON contract.

## Prediction Flow

1. Client uploads a leaf image as `multipart/form-data` with field name `image`.
2. `prediction_routes.py` receives the file through FastAPI `UploadFile`.
3. `prediction_service.py` reads and validates the uploaded image.
4. `image_preprocessing.py` loads the image with Pillow.
5. The image is converted to RGB, center-cropped, resized to `224x224`, and
   normalized from pixel values `0..255` to floating point values `0..1`.
6. The image becomes a TensorFlow batch shaped like `(1, 224, 224, 3)`.
7. `tensorflow_model.py` runs the Keras or TensorFlow Lite model.
8. The raw model output is converted into probabilities and sorted.
9. The top class label is parsed into `crop_name`, `disease_name`, `category`,
   and `is_healthy`.
10. The API returns structured JSON with confidence, image metadata, top
    predictions, and farmer guidance.

## Image Preprocessing

Models expect consistent input. Real user images are not consistent: they can be
large, rotated, PNG, JPEG, WebP, HEIC, portrait, landscape, or grayscale.

AgroMind preprocessing makes them consistent:

- Reject unsupported file types.
- Reject files larger than `MAX_IMAGE_BYTES`.
- Fix phone camera orientation with EXIF metadata.
- Convert everything to RGB.
- Center-crop and resize to the configured `IMAGE_SIZE`.
- Convert to `float32`.
- Normalize pixels into the `0..1` range.
- Add the batch dimension TensorFlow expects.

## REST API

Health check:

```http
GET /api/v1/health
```

Image prediction:

```http
POST /api/v1/predictions/leaf-disease
Content-Type: multipart/form-data
```

Form field:

```text
image=<leaf photo>
```

Example response shape:

```json
{
  "success": true,
  "model_loaded": true,
  "crop_name": "Tomato",
  "crop_category": "fungal",
  "disease_name": "Late Blight",
  "confidence_score": 0.94,
  "severity": "needs_attention",
  "treatment_suggestion": "For Tomato, the model detected Late Blight...",
  "prediction": {
    "label": "Tomato - Late Blight",
    "confidence": 0.94,
    "crop_name": "Tomato",
    "disease_name": "Late Blight",
    "category": "fungal",
    "is_healthy": false
  },
  "top_predictions": [],
  "image": {
    "original_width": 1280,
    "original_height": 960,
    "model_width": 224,
    "model_height": 224,
    "channels": 3
  },
  "processing_ms": 74
}
```

## TensorFlow Integration

The model adapter supports:

- `.keras` models through `tf.keras.models.load_model(..., compile=False)`.
- `.tflite` models through `tf.lite.Interpreter`.
- Startup warmup so the first real request is faster.
- A development fallback prediction when no model exists yet.

Put trained artifacts here:

```text
models/leaf_disease_model.keras
models/class_names.json
models/model_metadata.json
```

For production, use:

```env
ENABLE_DEMO_FALLBACK=false
AI_MODEL_PATH=models/leaf_disease_model.keras
AI_CLASS_NAMES_PATH=models/class_names.json
AI_MODEL_METADATA_PATH=models/model_metadata.json
```

## Production Notes

- Keep `ENABLE_DEMO_FALLBACK=false` in production.
- Keep `APP_ENV=production` in production so CORS uses `CORS_ORIGINS`.
- Use `/api/v1/health` for deployment health checks.
- Keep `class_names.json` in the same output order as the model neurons.
- Retrain and redeploy the model independently from the Node.js backend.
