from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


class PredictionItem(BaseModel):
    label: str
    confidence: float = Field(ge=0, le=1)


class LeafPredictionResponse(BaseModel):
    success: bool = True
    model_loaded: bool
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
    class_count: int
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
