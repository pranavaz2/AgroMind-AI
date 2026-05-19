# 🔌 API Reference

This document outlines the primary REST communication pathways between the React Native frontend, Node.js Orchestrator, and FastAPI Inference Service.

## 1. Cloud AI Prediction Orchestration

**Endpoint:** `POST /api/v1/scans` (Node.js)  
**Content-Type:** `multipart/form-data`

This is the main entry point for the mobile app. The Node.js server receives the image, validates health checks, forwards it to FastAPI, uploads it to Cloudinary, and saves the metadata to PostgreSQL.

### Request Payload (FormData)
| Key | Type | Required | Description |
|---|---|---|---|
| `image` | `file` | Yes | The leaf image buffer. |
| `farmId` | `string` | No | UUID of the farm to associate the scan with. |

### Response (200 OK)
```json
{
  "status": "success",
  "data": {
    "scan": {
      "id": "uuid-1234",
      "cropName": "Tomato___Early_blight",
      "imageUrl": "https://res.cloudinary.com/...",
      "status": "COMPLETED",
      "confidence": 99.8,
      "createdAt": "2026-05-19T13:30:00Z"
    },
    "analysis": {
      "diseaseName": "Tomato___Early_blight",
      "displayName": "Tomato Early blight",
      "confidence": 0.998,
      "severity": "High",
      "treatment": ["Remove affected leaves", "Apply fungicide"],
      "prevention": ["Rotate crops", "Ensure proper spacing"],
      "predictionTimeMs": 42,
      "predictionSource": "tensorflow_fastapi"
    }
  }
}
```

## 2. FastAPI Model Inference

**Endpoint:** `POST /api/predict` (FastAPI)  
**Content-Type:** `multipart/form-data`

This is an internal microservice endpoint. Node.js calls this endpoint with the raw file buffer to get ML predictions.

### Request Payload (FormData)
| Key | Type | Required | Description |
|---|---|---|---|
| `file` | `file` | Yes | The unnormalized leaf image buffer. |

### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "disease": "Tomato___Early_blight",
    "display_name": "Tomato Early Blight",
    "confidence": 0.998,
    "severity": "High",
    "treatment": ["..."],
    "prevention": ["..."],
    "prediction_time_ms": 42,
    "top_predictions": [
      { "label": "Tomato___Early_blight", "confidence": 0.998 },
      { "label": "Tomato___Late_blight", "confidence": 0.001 }
    ]
  }
}
```

## 3. Microservice Health Check

**Endpoint:** `GET /health` (FastAPI)

Used by Node.js to implement a "Fail-Fast" architecture, ensuring the AI model is loaded and ready before attempting to upload large image payloads.

### Response (200 OK)
```json
{
  "status": "healthy",
  "model_loaded": true,
  "device": "cpu"
}
```
