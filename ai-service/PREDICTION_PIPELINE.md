# AgroMind TensorFlow Prediction Pipeline

This guide explains how AgroMind saves a trained TensorFlow plant disease model,
loads it, and uses it for predictions from uploaded leaf images.

## Saved Model Files

After training, AgroMind saves the model and sidecar files:

```text
models/
  leaf_disease_model.keras
  class_names.json
  raw_class_names.json
  model_metadata.json
  evaluation.json
```

The `.keras` file contains the trained TensorFlow model architecture and
weights. The JSON files are the serving contract. They tell the API which output
neuron maps to which plant disease class.

The training script saves the model with:

```python
model.save(final_model_path, include_optimizer=False)
```

`include_optimizer=False` is intentional. Prediction does not need optimizer
state, so the inference artifact stays smaller.

## Environment Settings

The FastAPI service reads model paths from `.env`:

```env
AI_MODEL_PATH=models/leaf_disease_model.keras
AI_CLASS_NAMES_PATH=models/class_names.json
AI_MODEL_METADATA_PATH=models/model_metadata.json
IMAGE_SIZE=224
ENABLE_MODEL_WARMUP=true
ENABLE_DEMO_FALLBACK=false
```

For local first-pass testing, your `.env` can point at an experiment folder such
as:

```env
AI_MODEL_PATH=models/plantvillage_mobilenetv2_first_pass/leaf_disease_model.keras
AI_CLASS_NAMES_PATH=models/plantvillage_mobilenetv2_first_pass/class_names.json
AI_MODEL_METADATA_PATH=models/plantvillage_mobilenetv2_first_pass/model_metadata.json
```

## TensorFlow Model Loading

Model loading happens once when FastAPI starts:

```text
app/main.py
  -> app/core/dependencies.py
  -> app/model/tensorflow_model.py
```

The model adapter loads Keras models with:

```python
tf.keras.models.load_model(model_path, compile=False)
```

`compile=False` is best for inference. The API does not train the model, so it
does not need the optimizer, loss function, or training metrics in memory.

AgroMind also creates a TensorFlow inference function and runs a warmup
prediction. Warmup avoids making the first farmer request pay TensorFlow startup
cost.

## Model Inference

Inference means using a trained model to make a prediction on new data.

For AgroMind:

```text
leaf image -> preprocessing -> TensorFlow model -> probabilities -> JSON response
```

The model output is a list of probabilities. If the model has five classes, the
output might look conceptually like:

```json
[0.04, 0.02, 0.10, 0.79, 0.05]
```

The highest value is the predicted class. The API sorts the values and returns
the top predictions.

## Prediction Flow

The production upload flow is:

1. Client sends `POST /api/v1/predictions/leaf-disease`.
2. FastAPI receives an uploaded file named `image`.
3. The API validates file type and size.
4. Pillow opens the image and fixes EXIF orientation.
5. Image is converted to RGB.
6. Image is center-cropped and resized to `224x224`.
7. Pixels are normalized to `float32` values from `0..1`.
8. A batch dimension is added, giving shape `(1, 224, 224, 3)`.
9. TensorFlow runs inference.
10. Probabilities are sorted from highest to lowest.
11. Labels are parsed into crop, disease, category, and healthy status.
12. The API returns structured JSON.

## Prediction Endpoint

Start the API:

```powershell
.\.venv\Scripts\python.exe run.py
```

Open:

```text
http://127.0.0.1:8000/docs
```

Endpoint:

```http
POST /api/v1/predictions/leaf-disease
Content-Type: multipart/form-data
```

Field:

```text
image=<leaf photo>
```

Example response fields:

```json
{
  "model_loaded": true,
  "crop_name": "Tomato",
  "disease_name": "Late Blight",
  "confidence_score": 0.91,
  "prediction": {
    "label": "Tomato - Late Blight",
    "confidence": 0.91
  },
  "top_predictions": []
}
```

## Confidence Scores

A confidence score is the model probability for a class.

Example:

```text
Tomato - Late Blight: 0.91
```

means the model assigned 91% probability to that class among the classes it was
trained on.

Important production note: confidence is not the same as guaranteed truth. A
high confidence can still be wrong if the image is blurry, the disease is not in
the training classes, or the real field photo is very different from
PlantVillage images.

## Local Prediction Without FastAPI

You can test a saved model directly with:

```powershell
.\.venv\Scripts\python.exe -m training.predict_image --image "dataset/Tomato_healthy/000146ff-92a4-4db6-90ad-8fce2ae4fddd___GH_HL Leaf 259.1.JPG"
```

You can also pass explicit model paths:

```powershell
.\.venv\Scripts\python.exe -m training.predict_image --image "dataset/Tomato_healthy/000146ff-92a4-4db6-90ad-8fce2ae4fddd___GH_HL Leaf 259.1.JPG" --model-path models/leaf_disease_model.keras --class-names-path models/class_names.json --metadata-path models/model_metadata.json
```

This command uses the same TensorFlow loader and image preprocessing code as the
FastAPI service.

## Production Checklist

- Train model with `training.run_training_pipeline`.
- Keep `leaf_disease_model.keras`, `class_names.json`, and
  `model_metadata.json` together.
- Point `.env` at the saved model files.
- Set `ENABLE_DEMO_FALLBACK=false` in production.
- Confirm `/api/v1/health` returns `"model_loaded": true`.
- Test `/api/v1/predictions/leaf-disease` with real uploaded images.
- Monitor confidence and user feedback after deployment.
