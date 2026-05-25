from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.dependencies import get_leaf_model
from app.routes import health_routes, prediction_routes


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_leaf_model()
    yield


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="Python TensorFlow microservice for AgroMind AI leaf disease predictions.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if not settings.is_production else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_routes.router, prefix=settings.api_prefix)
app.include_router(prediction_routes.router, prefix=settings.api_prefix)


@app.get("/")
async def root():
    return {
        "success": True,
        "message": "AgroMind AI Prediction Service is running.",
        "docs": "/docs",
    }
