from functools import lru_cache

from app.core.config import get_settings
from app.model.tensorflow_model import TensorFlowLeafModel
from app.services.prediction_service import PredictionService


@lru_cache
def get_leaf_model() -> TensorFlowLeafModel:
    settings = get_settings()
    model = TensorFlowLeafModel(
        model_path=settings.ai_model_path,
        class_names=settings.class_names,
        enable_demo_fallback=settings.enable_demo_fallback,
        image_size=settings.image_size,
        metadata_path=settings.ai_model_metadata_path,
        warmup=settings.enable_model_warmup,
    )
    model.load()
    return model


def get_prediction_service() -> PredictionService:
    settings = get_settings()
    return PredictionService(settings=settings, model=get_leaf_model())
