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
  "prediction": {
    "label": "Early Blight",
    "confidence": 0.91
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
ai-service/DATASET.md
ai-service/PREPROCESSING.md
ai-service/TRAINING.md
```

Put your trained model here:

```text
ai-service/models/leaf_disease_model.keras
```

The training script also writes labels here:

```text
ai-service/models/class_names.json
```

The service reads that file automatically. If the file does not exist, set
labels in `.env` in the exact order of the model output:

```env
AI_CLASS_NAMES=Healthy,Early Blight,Late Blight,Leaf Spot,Rust
```

In production, set:

```env
ENABLE_DEMO_FALLBACK=false
```

That makes the service return `503` if the model is missing instead of using demo predictions.

## AI API Architecture

The app is layered:

- Route layer: HTTP details, upload field, status codes.
- Service layer: prediction workflow and response building.
- Model layer: TensorFlow loading and inference.
- Utility layer: image validation and preprocessing.
- Schema layer: stable JSON contracts.

This keeps the code easier to test, scale, and maintain.
