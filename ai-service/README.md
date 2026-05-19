# AgroMind AI Prediction Microservice

This is a production-ready Python AI microservice for AgroMind AI. It receives a crop leaf image, preprocesses it, runs a TensorFlow model, and returns structured JSON for the mobile app or Node backend.

## Why A Separate AI Microservice?

An AI microservice keeps machine-learning work separate from the main Node.js API.

- The Node server can focus on auth, users, farms, scans, community, and notifications.
- The Python service can focus on TensorFlow, image preprocessing, and prediction.
- You can scale them independently. AI prediction is CPU/GPU-heavy, while normal API traffic is lighter.
- You can deploy the AI service to a GPU machine later without rewriting the rest of AgroMind.

## Folder Architecture

```text
ai-service/
  app/
    core/       # settings, dependencies, app-level wiring
    routes/     # FastAPI endpoints
    services/   # business logic and prediction flow
    model/      # TensorFlow model adapter
    utils/      # image validation and preprocessing
    schemas/    # Pydantic response models
  training/     # MobileNetV2 training pipeline
  data/         # local datasets, ignored by git
  models/       # place trained .keras/.h5/SavedModel files here
```

## FastAPI Basics

FastAPI lets you create REST APIs with Python functions.

```python
@router.post("/leaf-disease")
async def predict_leaf_disease(image: UploadFile):
    ...
```

That function becomes an HTTP endpoint. FastAPI automatically validates inputs, generates OpenAPI docs, and serves interactive docs at `/docs`.

## Setup

```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python run.py
```

Open:

```text
http://localhost:8000/docs
```

## API Endpoints

Health check:

```http
GET /api/v1/health
```

Leaf disease prediction:

```http
POST /api/v1/predictions/leaf-disease
Content-Type: multipart/form-data

image=<leaf photo>
```

Example response:

```json
{
  "success": true,
  "model_loaded": true,
  "crop_name": "Tomato",
  "crop_category": "fungal",
  "disease_name": "Early Blight",
  "confidence_score": 0.91,
  "severity": "needs_attention",
  "treatment_suggestion": "For Tomato, the model detected Early Blight. Remove badly infected leaves and avoid overhead irrigation. Confirm locally before applying chemical treatment.",
  "label_details": {
    "raw_label": "Tomato___Early_blight",
    "crop_name": "Tomato",
    "disease_name": "Early Blight",
    "display_name": "Tomato - Early Blight",
    "is_healthy": false,
    "category": "fungal"
  },
  "prediction": {
    "label": "Tomato - Early Blight",
    "confidence": 0.91,
    "crop_name": "Tomato",
    "disease_name": "Early Blight",
    "category": "fungal",
    "is_healthy": false
  },
  "top_predictions": [
    { "label": "Early Blight", "confidence": 0.91 },
    { "label": "Healthy", "confidence": 0.06 }
  ],
  "image": {
    "original_width": 1280,
    "original_height": 960,
    "model_width": 224,
    "model_height": 224,
    "channels": 3
  },
  "advice": {
    "severity": "needs_attention",
    "summary": "The model detected signs that may match Early Blight.",
    "treatment_suggestion": "Isolate affected leaves where practical, monitor nearby plants, and ask a local agronomist to confirm the right treatment for Early Blight before applying chemicals.",
    "next_steps": [
      "Inspect 5-10 nearby plants to see if symptoms are spreading.",
      "Remove heavily infected leaves only if it is practical and safe.",
      "Ask a local agronomist before applying chemical pesticide or fungicide."
    ],
    "safety_note": "Use protective gear and follow label instructions for any chemical treatment."
  }
}
```

## Prediction Flow

1. The client uploads a leaf image as `multipart/form-data`.
2. The route receives the image with FastAPI `UploadFile`.
3. The service validates file type and size.
4. Pillow reads the image and converts it to RGB.
5. The image is resized to the model input size, default `224x224`.
6. NumPy normalizes pixel values from `0-255` into `0-1`.
7. TensorFlow runs `model.predict(batch)`.
8. The model output is converted into labels and confidence scores.
9. The API returns structured JSON with farmer-friendly advice.

## FastAPI Routes

The main app in `app/main.py` creates the FastAPI application, loads the model
during startup, and mounts route modules under `/api/v1`.

- `GET /api/v1/health`: reports service status, model load status, class count,
  and model metadata.
- `POST /api/v1/predictions/leaf-disease`: accepts the uploaded image field
  named `image`, runs inference, and returns the disease name, confidence score,
  severity, and treatment suggestion.

The prediction route translates known validation errors to `400`, model
availability problems to `503`, and unexpected failures to `500` with a safe
client message.

## Image Preprocessing

Preprocessing makes every uploaded image match the model's expected input.

- Convert to RGB so all images have 3 channels.
- Resize to `IMAGE_SIZE x IMAGE_SIZE`.
- Convert to `float32`.
- Normalize pixels by dividing by `255.0`.
- Add a batch dimension so TensorFlow receives shape `(1, 224, 224, 3)`.

## TensorFlow Model Integration

To train a real PlantVillage model, see:

```text
ai-service/AI_MICROSERVICE_GUIDE.md
ai-service/FASTAPI_PREDICTION_API.md
ai-service/DATASET.md
ai-service/PREPROCESSING.md
ai-service/TRAINING.md
ai-service/MODEL_SERVING.md
ai-service/MODEL_OPTIMIZATION.md
```

Put your trained model here:

```text
ai-service/models/leaf_disease_model.keras
```

The training script also writes labels here:

```text
ai-service/models/class_names.json
```

It also writes model metadata here:

```text
ai-service/models/model_metadata.json
```

The service reads that file automatically. If the file does not exist, set
labels in `.env` in the exact order of the model output. Prefer
`Crop___Disease_name` labels so the serving API can parse crop and disease
metadata automatically:

```env
AI_CLASS_NAMES=Tomato___healthy,Tomato___Early_blight,Tomato___Late_blight,Apple___Apple_scab,Corn___Common_rust
```

In production, set:

```env
ENABLE_DEMO_FALLBACK=false
```

That makes the service return `503` if the model is missing instead of using demo predictions.

## Model Inference

`app/model/tensorflow_model.py` loads the TensorFlow artifact once with
`tf.keras.models.load_model(..., compile=False)` for `.keras` models or a
TensorFlow Lite interpreter for `.tflite` models. The service creates a cached
model dependency, warms it up with a dummy image, and reuses it for every
request.

For each request, `app/utils/image_preprocessing.py` converts the uploaded image
into a normalized NumPy batch with shape `(1, IMAGE_SIZE, IMAGE_SIZE, 3)`.
The model adapter runs TensorFlow inference, normalizes logits into
probabilities when needed, sorts the class probabilities, and returns the top
ranked labels.

## Model Optimization

Use `training.optimize_tflite` to export smaller and faster TensorFlow Lite
artifacts:

```powershell
.\.venv\Scripts\python.exe -m training.optimize_tflite --model-path models/leaf_disease_model.keras
```

The script can produce dynamic range, float16, and int8 TFLite files plus an
`optimization_report.json` with file sizes and local inference timing. To serve
an optimized model from FastAPI, point `AI_MODEL_PATH` at the `.tflite` file.

## Multi-Crop Label Management

AgroMind supports multi-class classification across many crops. Each output
neuron maps to one class label such as:

```text
Tomato___Late_blight
Apple___Apple_scab
Corn___Common_rust
Potato___healthy
```

The label parser in `app/model/label_metadata.py` converts these flat model
labels into structured metadata:

- `crop_name`: Tomato, Apple, Corn, Potato.
- `disease_name`: Late Blight, Apple Scab, Common Rust, Healthy.
- `category`: healthy, fungal, bacterial, viral, or unknown.
- `display_name`: farmer-facing label such as `Tomato - Late Blight`.

This lets one scalable TensorFlow model serve many crop categories while the API
still returns clean crop-specific JSON and treatment suggestions.

## Crop-Specific Advice

Treatment guidance lives in `app/services/treatment_knowledge.py`. It first
looks for a crop-specific guide, such as tomato fungal disease advice, then
falls back to a disease-category guide. This keeps the prediction model and the
farmer advice system loosely coupled: you can add new crops or diseases by
adding labels and treatment rules without rewriting the FastAPI route.

## AI API Architecture

The app is layered:

- Route layer: HTTP details, upload field, status codes.
- Service layer: prediction workflow and response building.
- Model layer: TensorFlow loading and inference.
- Utility layer: image validation and preprocessing.
- Schema layer: stable JSON contracts.

This keeps the code easier to test, scale, and maintain.
