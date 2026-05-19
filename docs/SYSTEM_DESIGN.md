# 🏗️ System Design

This document details the microservice architecture of AgroMind AI, explaining how the components interact to deliver high-performance, fault-tolerant disease detection.

## 1. High-Level Architecture
AgroMind AI utilizes a modern decoupled stack:
- **Mobile Client**: React Native (Expo)
- **API Orchestrator**: Node.js / Express
- **Inference Engine**: Python / FastAPI / TensorFlow
- **Data Layers**: PostgreSQL (Prisma) & Cloudinary

## 2. The React Native Client
The mobile app is designed for unstable network conditions.
- Uses `axios` with `onUploadProgress` to provide visual feedback during large image uploads.
- Validates image formats and sizes *locally* before wasting bandwidth.
- Gracefully catches `503 Service Unavailable` and `504 Gateway Timeout` errors, offering frictionless "Retry" UI loops.

## 3. Node.js Orchestrator & The "Fail-Fast" Pattern
The Node.js server acts as the traffic director.
When an image arrives at `POST /scans`:
1. **Health Check**: Node pings the FastAPI `/health` endpoint. If the AI is offline, Node instantly aborts and returns an error to the user, saving processing time.
2. **Buffer Forwarding**: Node uses `FormData` to forward the raw `req.file.buffer` directly to FastAPI.
3. **Fail-Fast Evaluation**: If FastAPI returns a prediction successfully, Node proceeds. If FastAPI rejects the image or fails, the workflow stops.
4. **Permanent Storage**: Only successfully analyzed images are pushed to Cloudinary. This drastically reduces junk storage costs.
5. **Database Persistence**: The URL, confidence score, and raw JSON metadata are stored in PostgreSQL using Prisma.

## 4. FastAPI Inference Engine
The AI microservice is strictly isolated from application logic.
- **Stateless**: It receives an image, runs inference, and returns JSON. It does not know about users or databases.
- **Optimized Startup**: The MobileNetV2 `.keras` model is loaded into memory only once when Uvicorn boots. A "dummy tensor" is passed through the model on startup to warm up the computation graph, eliminating first-request latency.

## 5. PostgreSQL & JSON Persistence
Instead of maintaining a rigidly structured schema for every possible AI output (which changes as models upgrade), the `CropScan` table uses an `aiSummary` JSON column. This allows us to store arbitrary structured data (e.g., `predictionTimeMs`, `modelVersion`, `topPredictions`) without running risky database migrations every time the AI team adds a new feature.
