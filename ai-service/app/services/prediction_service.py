from time import perf_counter

from fastapi import UploadFile

from app.core.config import Settings
from app.model.tensorflow_model import TensorFlowLeafModel
from app.schemas.prediction import LeafPredictionResponse, PredictionItem
from app.utils.image_preprocessing import preprocess_leaf_image, read_image_upload


def build_farmer_advice(label: str, confidence: float) -> dict:
    normalized = label.lower()

    if "healthy" in normalized:
        return {
            "severity": "none",
            "summary": "The leaf looks healthy based on the current model prediction.",
            "next_steps": [
                "Continue routine field monitoring.",
                "Check soil moisture before irrigation.",
                "Keep leaves dry when possible to reduce fungal risk.",
            ],
            "safety_note": "This AI result is a screening tool. Recheck if symptoms appear later.",
        }

    return {
        "severity": "needs_attention" if confidence >= 0.65 else "uncertain",
        "summary": f"The model detected signs that may match {label}.",
        "next_steps": [
            "Inspect 5-10 nearby plants to see if symptoms are spreading.",
            "Remove heavily infected leaves only if it is practical and safe.",
            "Ask a local agronomist before applying chemical pesticide or fungicide.",
        ],
        "safety_note": "Use protective gear and follow label instructions for any chemical treatment.",
    }


class PredictionService:
    def __init__(self, settings: Settings, model: TensorFlowLeafModel):
        self.settings = settings
        self.model = model

    async def predict_leaf_disease(self, file: UploadFile) -> LeafPredictionResponse:
        started = perf_counter()
        image_bytes = await read_image_upload(file)
        batch, image_metadata = preprocess_leaf_image(image_bytes, self.settings.image_size)

        predictions = self.model.predict(batch)
        top_prediction = predictions[0]
        processing_ms = int((perf_counter() - started) * 1000)

        return LeafPredictionResponse(
            model_loaded=self.model.is_loaded,
            prediction=PredictionItem(**top_prediction),
            top_predictions=[PredictionItem(**item) for item in predictions],
            image={
                **image_metadata,
                "filename": file.filename,
                "content_type": file.content_type,
                "bytes": len(image_bytes),
            },
            advice=build_farmer_advice(
                top_prediction["label"],
                top_prediction["confidence"],
            ),
            processing_ms=processing_ms,
        )
