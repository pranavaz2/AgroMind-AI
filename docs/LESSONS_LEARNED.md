# 🧠 Lessons Learned & Engineering Post-Mortem

This document chronicles the engineering challenges, debugging journeys, and architectural decisions made while building and deploying the AgroMind AI platform.

---

## 1. The Machine Learning Journey

### A. The Double-Normalization Bug Investigation
- **The Symptom**: During early training runs, validation accuracy plateaued around **33%** (no better than random guessing for a 3-class system) and the training loss decreased at an extremely slow rate.
- **Root Cause Analysis**: 
  - The image preprocessing pipeline loaded raw image pixels as integers in the `[0, 255]` range.
  - A manual preprocessing function divided the pixels by `255.0` to normalize them into a `[0.0, 1.0]` float range.
  - However, the pretrained MobileNetV2 base model already included a built-in `Rescaling(scale=1./127.5, offset=-1)` layer as its first layer.
  - By feeding a pre-normalized `[0.0, 1.0]` float array into the rescaling layer, the pixel values were double-scaled down to the `[0.0, 0.0078]` range.
  - This tiny input range effectively zeroed out early feature activations in the neural network, causing severe vanishing gradients and keeping the model from learning.
- **The Fix**: Removed the manual `1/255.0` scaling step in the preprocessing pipeline, letting the model's internal Rescaling layer handle raw pixel inputs. Accuracy immediately climbed to **90%+** in early training epochs.

### B. Validation Accuracy Improvement (33% → 98.35%)
To maximize model performance and robustness, we implemented three key strategies:
1. **Freezing BatchNormalization Layers**: Preserved ImageNet's learned statistics by keeping the base model's BN layers in inference mode (`training=False` during compilation). This prevented the model from resetting its running mean and variance variables on our small datasets.
2. **Simplified Classification Head**: Replaced VGG-style dense layers with a single GlobalAveragePooling2D followed by a Dense 128 (ReLU) layer and a Dropout (0.4) layer before the final Softmax. This mitigated extreme overfitting.
3. **Data Augmentation**: Added random horizontal/vertical flips, minor rotations (0.15), and zoom factor adjustments (0.1) directly into the tf.data pipeline, achieving a final validation accuracy of **98.35%** and a **100% Top-3 accuracy**.

---

## 2. Cloud Deployment Challenges & Fixes

### A. Railway Memory Limitations (OOM Crashes)
- **The Problem**: Initial attempts to deploy the FastAPI service resulted in instant container crashes marked by `SIGKILL` or `Killed` in Railway's deploy logs. Memory metrics showed usage spiking past the 500MB Hobby limit.
- **The Investigation**: The Python service was running `uvicorn app.main:app` with multiple worker processes. Each worker process loaded a separate copy of TensorFlow and the MobileNetV2 model graph into RAM, instantly exhausting the host machine's memory limit.
- **The Fix**: 
  - Restructured the Python app startup to load the model **once** globally during FastAPI's `@asynccontextmanager lifespan` startup event.
  - Configured Gunicorn as a process manager in the [Procfile](Procfile) with a single worker process (`-w 1`) and a custom worker class (`-k uvicorn.workers.UvicornWorker`).
  - Set the environment variable `TF_CPP_MIN_LOG_LEVEL=2` to suppress hundreds of lines of XLA and NUMA warning logs, which reduced startup CPU overhead.

### B. Python Compatibility & Nixpacks Failures
- **The Problem**: Railway uses Nixpacks to auto-detect and build Python services. By default, it was compiling Python 3.12/3.13, which had compatibility issues with pre-compiled TensorFlow binary wheels, causing the build to fail.
- **The Fix**: Added a `.python-version` file specifying `python-3.11.9`. This pinned Python to a stable, compatible version that easily installs pre-built TensorFlow binaries.

### C. `tensorflow` vs `tensorflow-cpu` Migration
- **The Rationale**: The standard `tensorflow` package includes heavy GPU-support binaries (CUDA, cuDNN) that bloat the container size to over **1.5GB** and consume substantial RAM on boot. Since our cloud microservice on Railway only runs CPU inference, we migrated to the lightweight `tensorflow-cpu` library. This reduced the build time, package size, and startup memory footprint.

---

## 3. Node.js Backend Orchestration Decisions

### A. The "Fail-Fast" Image Stream Architecture
- **Legacy Flow**: The React Native app uploaded photos directly to Cloudinary, then sent the URL to the Node.js API, which forwarded it to the AI service. If the AI service rejected the image (due to lack of a leaf or bad quality), we had already spent network bandwidth and paid Cloudinary storage fees.
- **Modern Flow**: 
  1. Mobile app uploads the raw image buffer to the Node.js API.
  2. Node.js queries the FastAPI service `/health` endpoint first (fail-fast health check).
  3. If online, Node.js forwards the raw buffer directly to FastAPI.
  4. Only if FastAPI successfully identifies a crop disease with high confidence does Node.js upload the image to Cloudinary and commit the scan record to PostgreSQL.
  5. This reduced Cloudinary storage consumption and optimized network traffic.

### B. Dual-Mode Routing Integration
To ensure the backend works flawlessly across different deployment configurations:
- The [aiService.js](server/src/services/aiService.js) checks production `/api/v1/health` first and falls back to legacy `/health`.
- It forwards image buffers to `/api/v1/predictions/leaf-disease` first, falling back to `/api/predict`.
- It appends the image buffer under both `'file'` and `'image'` keys in `FormData` to accommodate endpoint parameter variations.
