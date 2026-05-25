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
        class_count=len(settings.class_names),
    )
