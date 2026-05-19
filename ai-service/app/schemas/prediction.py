from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


class PredictionItem(BaseModel):
    label: str
    confidence: float = Field(ge=0, le=1)
    crop_name: str | None = None
    disease_name: str | None = None
    category: str | None = None
    is_healthy: bool | None = None


class LeafPredictionResponse(BaseModel):
    success: bool = True
    model_loaded: bool
    crop_name: str
    crop_category: str
    disease_name: str
    confidence_score: float = Field(ge=0, le=1)
    severity: str
    treatment_suggestion: str
    prevention_tips: list[str]
    label_details: dict[str, Any]
    prediction: PredictionItem
    top_predictions: list[PredictionItem]
    image: dict[str, Any]
    advice: dict[str, Any]
    processing_ms: int
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class HealthResponse(BaseModel):
    success: bool = True
    service: str
    environment: str
    model_loaded: bool
    model_path: str
    model_error: str | None = None
    class_count: int
    image_size: int
    max_image_bytes: int
    top_k_predictions: int
    runtime: str
    demo_fallback_enabled: bool
    model_metadata: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
