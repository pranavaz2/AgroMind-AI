from fastapi import APIRouter, Depends

from app.core.config import Settings, get_settings
from app.core.dependencies import get_leaf_model
from app.model.tensorflow_model import TensorFlowLeafModel
from app.schemas.prediction import HealthResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def health_check(
    settings: Settings = Depends(get_settings),
    model: TensorFlowLeafModel = Depends(get_leaf_model),
) -> HealthResponse:
    return HealthResponse(
        service=settings.app_name,
        environment=settings.app_env,
        model_loaded=model.is_loaded,
        model_path=str(model.model_path),
        model_error=model.load_error,
        class_count=len(settings.class_names),
        image_size=settings.image_size,
        max_image_bytes=settings.max_image_bytes,
        top_k_predictions=settings.top_k_predictions,
        runtime=model.status["runtime"],
        demo_fallback_enabled=settings.enable_demo_fallback,
        model_metadata=model.metadata,
    )
