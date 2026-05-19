from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import logging
from contextlib import asynccontextmanager

from routes.predict import router as predict_router
from services.prediction_service import load_model_and_classes

# Configure basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uvicorn.error")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan event handler for FastAPI.
    This replaces the old @app.on_event("startup") approach.
    It ensures the model is loaded ONCE when the server starts,
    and handles any necessary cleanup when the server stops.
    """
    logger.info("Starting up AgroMind AI Prediction Service...")
    # Load model and class names into memory
    load_model_and_classes()
    
    yield # Server is running
    
    logger.info("Shutting down AgroMind AI Prediction Service...")
    # Any cleanup code would go here
    

# Initialize FastAPI app with lifespan
app = FastAPI(
    title="AgroMind AI API",
    description="Production-level crop disease prediction API powered by TensorFlow MobileNetV2.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS (Cross-Origin Resource Sharing)
# Allow requests from the React Native app or a web dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to specific domains/IPs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include the prediction routes
app.include_router(predict_router)

@app.get("/health")
async def health_check():
    """
    Simple health check endpoint to verify the server is running.
    Useful for container orchestration (Docker/Kubernetes).
    """
    return {
        "status": "online", 
        "service": "AgroMind AI API"
    }

# Entry point for running the server directly (e.g. for debugging)
if __name__ == "__main__":
    import uvicorn
    # Using reload=False because model loading is heavy
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
