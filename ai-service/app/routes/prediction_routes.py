from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.dependencies import get_prediction_service
from app.schemas.prediction import LeafPredictionResponse
from app.services.prediction_service import PredictionService
from app.utils.image_preprocessing import ImageValidationError

router = APIRouter(prefix="/predictions", tags=["Predictions"])


@router.post("/leaf-disease", response_model=LeafPredictionResponse)
async def predict_leaf_disease(
    image: UploadFile = File(..., description="Leaf image to analyze."),
    service: PredictionService = Depends(get_prediction_service),
) -> LeafPredictionResponse:
    try:
        return await service.predict_leaf_disease(image)
    except ImageValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
