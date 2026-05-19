from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import logging

from services.preprocess import preprocess_image
from services.prediction_service import predict_disease

router = APIRouter(prefix="/api", tags=["Prediction"])
logger = logging.getLogger("uvicorn.error")

@router.post("/predict")
async def predict(file: UploadFile = File(...)):
    """
    Endpoint to predict crop disease from an uploaded image.
    
    Flow:
    1. Validate file type.
    2. Read image bytes asynchronously.
    3. Preprocess image into TensorFlow format.
    4. Run inference using the pre-loaded model.
    5. Return JSON response.
    """
    
    # 1. Validate file content type
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400, 
            detail=f"File provided is not an image. Provided: {file.content_type}"
        )
        
    try:
        # 2. Read file bytes
        # This is an async I/O operation
        image_bytes = await file.read()
        
        # 3. Preprocess image
        # This is a CPU-bound operation, but it's fast enough to run directly
        image_tensor = preprocess_image(image_bytes)
        
        # 4. Predict
        # TF predict is CPU/GPU bound
        prediction_result = predict_disease(image_tensor)
        
        # 5. Return success JSON
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "data": prediction_result
            }
        )
        
    except HTTPException as e:
        # Re-raise known HTTP exceptions (like from preprocessing)
        raise e
    except Exception as e:
        logger.error(f"Error during prediction: {str(e)}", exc_info=True)
        # 500 Internal Server Error for unexpected issues
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "An internal error occurred during prediction.",
                "detail": str(e)
            }
        )
