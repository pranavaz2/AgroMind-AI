# AgroMind FastAPI Prediction API

This API receives a crop leaf image, runs TensorFlow model inference, and
returns a structured plant disease prediction.

## Endpoint

```http
POST /api/v1/predictions/leaf-disease
Content-Type: multipart/form-data
```

Form field:

```text
image=<leaf photo>
```

Open interactive docs:

```text
http://127.0.0.1:8000/docs
```

## FastAPI Routes

FastAPI routes are Python functions connected to HTTP endpoints.

The prediction route lives in:

```text
app/routes/prediction_routes.py
```

The key route is:

```python
@router.post("/leaf-disease")
async def predict_leaf_disease(image: UploadFile = File(...)):
    ...
```

Because the router is mounted under `/api/v1/predictions`, the full URL becomes:

```text
/api/v1/predictions/leaf-disease
```

## Image Upload Flow

1. Mobile app or backend uploads a leaf image as `multipart/form-data`.
2. FastAPI receives the image as `UploadFile`.
3. The service checks file type and size.
4. Pillow opens the image and fixes camera orientation.
5. The image is converted to RGB.
6. The image is resized to `224x224`.
7. Pixels are normalized to `float32` values from `0..1`.
8. TensorFlow receives a batch shaped `(1, 224, 224, 3)`.
9. The model returns probabilities for each disease class.
10. The API returns JSON with disease, confidence, treatment, and prevention.

## Inference APIs

Inference means using a trained model to predict on new data.

In AgroMind, the inference API is the FastAPI endpoint that wraps the TensorFlow
model:

```text
HTTP upload -> preprocessing -> TensorFlow model -> JSON response
```

This keeps AI logic separate from the mobile app and Node.js backend. The app
does not need to know TensorFlow. It only sends an image and reads JSON.

## Response Shape

The response includes:

- `disease_name`
- `confidence_score`
- `treatment_suggestion`
- `prevention_tips`
- `top_predictions`
- image metadata
- processing time

Example:

```json
{
  "success": true,
  "model_loaded": true,
  "crop_name": "Tomato",
  "disease_name": "Late Blight",
  "confidence_score": 0.91,
  "severity": "needs_attention",
  "treatment_suggestion": "For Tomato, the model detected Late Blight...",
  "prevention_tips": [
    "Water at soil level and avoid wetting leaves.",
    "Space plants well and prune dense foliage for airflow."
  ],
  "prediction": {
    "label": "Tomato - Late Blight",
    "confidence": 0.91
  },
  "top_predictions": []
}
```

## Error Handling

The route returns clear HTTP status codes:

- `400`: unsupported file type, empty file, unreadable image, or image too large.
- `503`: TensorFlow model is unavailable.
- `500`: unexpected server error.

Production errors are logged internally, while the client receives a safe
message.

## Test With Curl

```powershell
curl.exe -X POST http://127.0.0.1:8000/api/v1/predictions/leaf-disease -F "image=@dataset/Tomato_healthy/000146ff-92a4-4db6-90ad-8fce2ae4fddd___GH_HL Leaf 259.1.JPG"
```

## Architecture

```text
app/routes/prediction_routes.py      # HTTP endpoint and error mapping
app/services/prediction_service.py   # Prediction workflow and response building
app/model/tensorflow_model.py        # TensorFlow loading and inference
app/utils/image_preprocessing.py     # Upload validation and image preprocessing
app/schemas/prediction.py            # JSON response schema
```

This structure keeps the API production-ready because each layer has one clear
job.
