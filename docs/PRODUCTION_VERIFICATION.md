# ✅ AgroMind AI — Production Verification Masterclass

With the Python 3.11.9 and `tensorflow-cpu` patches pushed, your deployment should now be successfully building. Once Railway finishes the build, it enters the **Deploy** stage. 

Because we are dealing with heavy Machine Learning workloads, verifying the deployment goes far beyond just seeing a "Success" badge. This document outlines the exact workflow to verify that your TensorFlow model is stable, performant, and ready for real users.

---

## 1. Monitor the Deployment Lifecycle & Logs
In your Railway Dashboard, click the `ai` service and go to the **Deploy Logs** tab. You are looking for a highly specific sequence of events that proves our Gunicorn optimization worked:

### Expected Healthy Log Sequence:
1. `[INFO] Starting gunicorn 22.0.0`
2. `[INFO] Listening at: http://0.0.0.0:8000`
3. `[INFO] Booting worker with pid: <number>` *(You must only see exactly ONE worker booting!)*
4. `[INFO] Loading MobileNetV2 model...` *(This may take 5-10 seconds. Do not panic if it hangs here).*
5. `[INFO] Warmup inference complete.`
6. `[INFO] Application startup complete.`

### 🚨 Red Flags to Watch For:
*   **Log Spam**: If you see hundreds of lines about `NUMA nodes` or `XLA configurations`, you forgot to set the `TF_CPP_MIN_LOG_LEVEL=2` environment variable in Railway!
*   **Worker Restarts**: If you see `Booting worker...` followed shortly by `Worker exiting (pid: <number>)` and then another `Booting worker...`, Gunicorn is caught in a crash loop. This usually means an OOM (Out of Memory) kill occurred.
*   **Timeout Errors**: If Gunicorn kills the worker explicitly citing a "Timeout", Railway's CPU was too slow to load the model within 120 seconds. (Extremely rare on our new config).

---

## 2. Verify Railway Memory Stability
Before hitting the API, verify the baseline memory:
1. Click the **Metrics** tab on the `ai` service.
2. Look at the **Memory Usage** graph.
3. Because we forced `tensorflow-cpu` and `-w 1` (single worker), memory should plateau and flatten out between **200MB and 350MB**. If it is hovering around 900MB+, a configuration is wrong.

---

## 3. Public API Verification Flow
Once the logs show `Application startup complete`, we can test the live endpoints. 
*(Note: You must have generated a Public Domain in the Settings tab of the `ai` service for this).*

### Step A: Health Check
1. Open your browser to: `https://[your-railway-domain]/health`
2. **Expected Response**: `{"status": "online", "service": "AgroMind AI API"}`
3. If this loads instantly, the Gunicorn routing is perfect.

### Step B: Swagger UI Verification
1. Navigate to: `https://[your-railway-domain]/docs`
2. **Expected Response**: The beautiful FastAPI Swagger interface should load, displaying the `POST /api/predict` route.

### Step C: Live Image Prediction
We will use the Swagger UI to run a real inference test without needing the mobile app!
1. In the Swagger UI, click the **POST `/api/predict`** route.
2. Click **Try it out**.
3. Under the `file` input, click **Choose File** and upload a test image of a plant leaf from your computer.
4. Click **Execute**.

**What is happening under the hood?**
*   If this is the first request of the hour, Railway might have put the container to sleep. The request might take 10-15 seconds (Cold Start).
*   FastAPI will convert the image bytes, resize it to `224x224`, and run it through the pre-loaded MobileNetV2 graph.

**Expected JSON Response:**
```json
{
  "diseaseName": "Tomato_Early_blight",
  "confidence": 98.45,
  "severity": "High",
  "treatment": "Apply copper-based fungicides...",
  "prevention": "Rotate crops..."
}
```

---

## 4. Cold-Start & Rollback Troubleshooting

### Cold-Start Verification
To verify cold-start resilience, do not ping the server for 30 minutes. Then, open the mobile app and scan a leaf. If the app crashes with a `503` or `504` error, the Railway container took too long to wake up. 
**The Fix**: Use [UptimeRobot](https://uptimerobot.com) to ping the `/health` endpoint every 5 minutes to prevent the container from ever sleeping.

### Rollback Strategy
If you accidentally push a commit that breaks the TensorFlow inference (e.g., corrupting the `.keras` model file):
1. In Railway, go to the `ai` service → **Deployments** tab.
2. Find the previous deployment with the green `Active` badge.
3. Click the three dots (`...`) next to it and select **Rollback**. 
4. Railway will instantly route all traffic back to the working container while you fix your code locally.
