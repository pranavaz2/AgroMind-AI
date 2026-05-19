import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.dependencies import get_prediction_service
from app.schemas.prediction import LeafPredictionResponse
from app.services.prediction_service import PredictionService
from app.utils.image_preprocessing import ImageValidationError

router = APIRouter(prefix="/predictions", tags=["Predictions"])
logger = logging.getLogger(__name__)


@router.post(
    "/leaf-disease",
    response_model=LeafPredictionResponse,
    summary="Predict crop leaf disease from an uploaded image",
    responses={
        400: {"description": "The uploaded file is missing, too large, or not a supported image."},
        503: {"description": "The TensorFlow model is unavailable."},
        500: {"description": "Unexpected prediction service error."},
    },
)
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
    except Exception as exc:
        logger.exception("Unhandled leaf disease prediction error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Prediction failed. Please try again with a clear leaf image.",
        ) from exc
