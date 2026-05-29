from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import logging

from services.preprocess import preprocess_image
from services.prediction_service import predict_disease

router = APIRouter(prefix="/api", tags=["Prediction"])
logger = logging.getLogger("uvicorn.error")

def parse_class_details(class_name: str):
    # Normalize class_name just in case it has ___ or _
    normalized = class_name.replace("___", " - ").replace("_", " ")
    parts = normalized.split(" - ")
    crop = parts[0].strip() if len(parts) > 0 else "Unknown"
    disease = parts[1].strip() if len(parts) > 1 else "healthy"
    
    is_healthy = "healthy" in disease.lower() or "healthy" in crop.lower()
    
    # categories: fungal, bacterial, viral, healthy, unknown
    disease_lower = disease.lower()
    if is_healthy:
        category = "healthy"
    elif "blight" in disease_lower or "rust" in disease_lower or "scab" in disease_lower:
        category = "fungal"
    elif "bacterial" in disease_lower:
        category = "bacterial"
    elif "virus" in disease_lower or "viral" in disease_lower:
        category = "viral"
    else:
        category = "fungal" # default fallback
        
    display_name = f"{crop} - {disease}" if not is_healthy else f"{crop} - Healthy"
    
    return {
        "crop_name": crop,
        "disease_name": disease,
        "display_name": display_name,
        "is_healthy": is_healthy,
        "category": category
    }

@router.post("/predict")
async def predict(file: UploadFile = File(None), image: UploadFile = File(None)):
    """
    Endpoint to predict crop disease from an uploaded image.
    Supports legacy prediction path.
    """
    upload_file = file or image
    if not upload_file:
        raise HTTPException(
            status_code=400,
            detail="No file provided. Please provide a file parameter."
        )
        
    if not upload_file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400, 
            detail=f"File provided is not an image. Provided: {upload_file.content_type}"
        )
        
    try:
        image_bytes = await upload_file.read()
        image_tensor = preprocess_image(image_bytes)
        prediction_result = predict_disease(image_tensor)
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "data": prediction_result
            }
        )
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error during prediction: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "An internal error occurred during prediction.",
                "detail": str(e)
            }
        )

@router.post("/v1/predictions/leaf-disease")
async def predict_leaf_disease(file: UploadFile = File(None), image: UploadFile = File(None)):
    """
    Endpoint to predict crop disease from an uploaded image matching production format.
    Exposes /api/v1/predictions/leaf-disease.
    """
    upload_file = image or file
    if not upload_file:
        raise HTTPException(
            status_code=400,
            detail="No image file provided."
        )
        
    if not upload_file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400, 
            detail=f"File provided is not an image. Provided: {upload_file.content_type}"
        )
        
    try:
        image_bytes = await upload_file.read()
        image_tensor = preprocess_image(image_bytes)
        prediction_result = predict_disease(image_tensor)
        
        top_class = prediction_result["disease"]
        details = parse_class_details(top_class)
        
        # Map top predictions list to the schema
        formatted_top_predictions = []
        for p in prediction_result["top_predictions"]:
            p_details = parse_class_details(p["class"])
            formatted_top_predictions.append({
                "label": p_details["display_name"],
                "confidence": p["confidence"],
                "crop_name": p_details["crop_name"],
                "disease_name": p_details["disease_name"],
                "category": p_details["category"],
                "is_healthy": p_details["is_healthy"]
            })
            
        prediction_item = formatted_top_predictions[0]
        
        response_data = {
            "success": True,
            "model_loaded": True,
            "crop_name": details["crop_name"],
            "crop_category": details["category"],
            "disease_name": details["disease_name"],
            "confidence_score": prediction_result["confidence"],
            "severity": prediction_result["severity"].lower(),
            "treatment_suggestion": prediction_result["treatment"],
            "prevention_tips": [prediction_result["prevention"]] if isinstance(prediction_result["prevention"], str) else prediction_result["prevention"],
            "label_details": {
                "raw_label": top_class.replace(" - ", "___").replace(" ", "_"),
                "crop_name": details["crop_name"],
                "disease_name": details["disease_name"],
                "display_name": details["display_name"],
                "is_healthy": details["is_healthy"],
                "category": details["category"]
            },
            "prediction": prediction_item,
            "top_predictions": formatted_top_predictions,
            "image": {
                "filename": upload_file.filename,
                "content_type": upload_file.content_type,
                "bytes": len(image_bytes)
            },
            "advice": {
                "severity": prediction_result["severity"].lower(),
                "summary": f"The model detected signs that may match {details['display_name']}." if not details["is_healthy"] else f"The {details['crop_name'].lower()} leaf looks healthy.",
                "treatment_suggestion": prediction_result["treatment"],
                "prevention_tips": [prediction_result["prevention"]] if isinstance(prediction_result["prevention"], str) else prediction_result["prevention"]
            },
            "processing_ms": prediction_result["prediction_time_ms"]
        }
        
        return JSONResponse(
            status_code=200,
            content=response_data
        )
        
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error during prediction: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "An internal error occurred during prediction.",
                "detail": str(e)
            }
        )
