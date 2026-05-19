# AgroMind TensorFlow Model Optimization

This guide explains how to make the AgroMind AI disease model faster, smaller,
and ready for mobile or edge inference.

## Optimization Goals

The production Keras model is best for training and server-side iteration. For
faster inference and smaller deployment artifacts, export TensorFlow Lite files.

Optimization targets:

- Faster startup and prediction latency.
- Smaller model downloads and container images.
- Lower memory use on CPU-only machines.
- Mobile readiness for future on-device inference.
- Cleaner benchmark reports for comparing artifacts.

## Export TensorFlow Lite Models

From `ai-service`:

```powershell
.\.venv\Scripts\python.exe -m training.optimize_tflite --model-path models/leaf_disease_model.keras
```

This writes optimized artifacts to:

```text
models/optimized/
  leaf_disease_dynamic.tflite
  leaf_disease_float16.tflite
  optimization_report.json
```

For full integer quantization, provide representative calibration images:

```powershell
.\.venv\Scripts\python.exe -m training.optimize_tflite `
  --model-path models/leaf_disease_model.keras `
  --representative-data-dir data/processed/plantvillage/train `
  --quantization int8
```

## Quantization Options

Dynamic range quantization:

- Compresses model weights.
- Usually keeps accuracy close to the original model.
- Good default for server CPU deployment.
- Does not need calibration images.

Float16 quantization:

- Stores weights in 16-bit floating point.
- Often works well on mobile GPUs and accelerators.
- Smaller than the original Keras model.
- Good candidate for Android/iOS acceleration.

Full int8 quantization:

- Quantizes weights and activations.
- Usually gives the smallest model and strong CPU performance.
- Requires representative images for calibration.
- Must be validated carefully because accuracy can drop if calibration data is weak.

## Serving A TFLite Model

The FastAPI model adapter can load either `.keras` or `.tflite` artifacts. To
serve a TensorFlow Lite model, set:

```env
AI_MODEL_PATH=models/optimized/leaf_disease_dynamic.tflite
```

The API contract stays the same:

```text
POST /api/v1/predictions/leaf-disease
```

The adapter handles TFLite tensor allocation, quantized input conversion, output
dequantization, and top-class sorting internally.

## Inference Optimization

AgroMind keeps inference fast by:

- Loading the model once during FastAPI startup.
- Reusing the same TensorFlow or TFLite runtime for every request.
- Resizing images to the model input size before inference.
- Normalizing pixels once in the preprocessing layer.
- Warming up the model before the first user request.
- Returning only the top predictions needed by the client.

## Mobile Performance

TensorFlow Lite is the preferred format for future on-device AgroMind inference.
It is built for mobile constraints: small binary size, low memory pressure, and
hardware acceleration through platform delegates.

Recommended mobile path:

1. Train and evaluate the Keras model.
2. Export dynamic, float16, and int8 TFLite variants.
3. Compare `optimization_report.json` latency and file size.
4. Validate accuracy on the held-out test set.
5. Use float16 for GPU/mobile accelerators or int8 for smallest CPU deployment.

Never choose the smallest model only by file size. Always compare disease
classification accuracy and farmer-facing safety behavior.
