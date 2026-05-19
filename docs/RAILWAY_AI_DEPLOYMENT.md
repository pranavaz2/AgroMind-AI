# 🧠 AgroMind AI — Railway AI Deployment Masterclass

Deploying a heavy TensorFlow model to a Platform-as-a-Service (PaaS) like Railway requires extreme caution regarding memory management. 

If you attempt to run `uvicorn` or multiple worker threads natively, TensorFlow will consume all available RAM (often exceeding 1GB+ per thread), resulting in your container being instantly killed with an **OOM (Out Of Memory)** error.

Here is exactly how we have hardened the `ai-service` for flawless execution on Railway.

---

## 1. Process Management (Gunicorn + Uvicorn)
Instead of running `uvicorn` directly, we are using **Gunicorn** as a process manager. Gunicorn is an industry-standard WSGI server that expertly manages Python processes, handles unexpected crashes, and buffers requests.

In `ai-service/Procfile`, we define the exact startup command:
```bash
web: gunicorn main:app -w 1 -k uvicorn.workers.UvicornWorker --timeout 120
```

### Breaking down the optimization:
*   **`-w 1` (Exactly 1 Worker)**: This is the most critical configuration. By restricting Gunicorn to a single worker, we guarantee that the 15MB `.keras` MobileNetV2 graph is only loaded into RAM **once**. This keeps our memory footprint well under Railway's base limits (usually around 200MB - 350MB).
*   **`-k uvicorn.workers.UvicornWorker`**: We tell Gunicorn to use Uvicorn internally, retaining FastAPI's lightning-fast asynchronous event loop.
*   **`--timeout 120`**: Machine learning models take time to boot. If Railway puts your container to sleep, the next scan will trigger a "Cold Start". Gunicorn's default timeout is 30 seconds. If loading TensorFlow takes 35 seconds, Gunicorn will assume the worker is dead and kill it. By extending this to 120 seconds, we ensure cold starts *always* succeed.

---

## 2. Startup Model Warmup
In `main.py`, we utilize FastAPI's `@asynccontextmanager lifespan` event:
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model_and_classes() # Loads into RAM instantly on boot
    yield
```
This guarantees that before the server accepts *any* HTTP requests, the model is fully loaded and ready for inference. 

---

## 3. Internal Networking (The Railway Advantage)
Because we deployed both the Node.js backend and the AI service inside the same Railway project, we do not need to expose the AI service to the public internet!

**How it works:**
1. Your React Native app talks to Node.js (Public).
2. Node.js talks to FastAPI using Railway's internal DNS: `http://ai.railway.internal:8000`.
3. This skips the public internet entirely, resulting in **zero bandwidth costs** for internal image transfers and **microsecond latency**.

---

## 4. Environment Variable Optimization
To drastically reduce CPU overhead and log buffer usage on Railway, you must set the following environment variable in the `ai` service on Railway:
```
TF_CPP_MIN_LOG_LEVEL=2
```
**Why?** By default, TensorFlow prints hundreds of debug messages (NUMA nodes, CUDA driver checks, CPU optimizations) to `stdout` every time it boots. Railway charges for CPU usage, and logging massive amounts of text consumes CPU cycles and clutters your deployment logs. Setting this to `2` tells TensorFlow to only print actual Errors, keeping your logs perfectly clean and efficient.

---

## 5. Production Monitoring Checklist

### Checking for Memory Leaks
1. Open your Railway Dashboard.
2. Click on the `ai` service and navigate to the **Metrics** tab.
3. Watch the **Memory Usage** graph while you submit 5-10 rapid image scans from the app.
4. The memory should spike slightly during inference but immediately return to a flat baseline (around ~250MB). If it constantly climbs like a staircase, a memory leak is occurring.

### Handling Sleep States
If you are on Railway's Hobby tier, the AI container will sleep after inactivity.
*   **The Symptom**: The first scan of the day takes 10+ seconds.
*   **The Solution**: We have configured `AI_SERVICE_TIMEOUT_MS=30000` in Node.js to patiently wait for this. To prevent it entirely, use a free service like **UptimeRobot** to ping the `/health` endpoint every 5 minutes.

### Troubleshooting Crash Loops
If the AI service constantly restarts, check the **Deploy Logs**.
*   If you see `Killed` or `SIGKILL`, it ran out of RAM. Ensure `-w 1` is strictly set in the Procfile.
*   If you see `ImportError: libGL.so.1`, it means OpenCV dependencies are missing (we bypass this by using pure `Pillow` and `numpy` for image preprocessing instead of heavy OpenCV).
