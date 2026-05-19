# 🧪 Testing & QA Checklist

Before deploying AgroMind AI to production, ensure the following flows are verified across all services.

## 1. AI Inference Pipeline (FastAPI)
- [ ] **Startup Behavior**: Ensure the MobileNetV2 `.keras` model loads only *once* during startup.
- [ ] **Warm-up**: Verify that a dummy tensor is passed through the model on startup to prevent latency on the first real request.
- [ ] **Valid Image Prediction**: Send a clear JPG of an early blight tomato leaf via Postman. Ensure confidence > 90%.
- [ ] **Corrupted Image Handling**: Send a corrupted/truncated image file. Ensure FastAPI returns a clean 400 error, not a 500 crash.

## 2. Orchestration Backend (Node.js)
- [ ] **Health Check Routing**: Stop the FastAPI server. Send an image to Node.js. Ensure Node returns a `503 Service Unavailable` without crashing.
- [ ] **Cloudinary Cost Optimization**: Verify that if the AI service fails or rejects an image, the image is **not** uploaded to Cloudinary.
- [ ] **Prisma Persistence**: Complete a successful scan. Query PostgreSQL to ensure `aiSummary` contains the full JSON payload (including `predictionTimeMs`).

## 3. Mobile Frontend (React Native)
- [ ] **Upload Progress**: Throttle network speed in Expo Dev Menu to "3G". Upload an image and verify the `Uploading... X%` indicator works.
- [ ] **Low Confidence UI**: Upload a picture of a keyboard or random object. Ensure the AI returns a low confidence score, and the yellow `<70%` warning banner appears on the Results Screen.
- [ ] **Image Validation**: Try uploading a PDF or 50MB file. Ensure the local React Native validation catches it immediately and displays the red error banner.
- [ ] **Offline Resilience**: Turn off Wifi/Data on your phone. Attempt a scan. Verify the "Retry Analysis" button appears gracefully.
