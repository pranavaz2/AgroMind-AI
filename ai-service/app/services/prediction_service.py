from time import perf_counter

from fastapi import UploadFile

from app.core.config import Settings
from app.model.label_metadata import LabelMetadata, parse_label
from app.model.tensorflow_model import TensorFlowLeafModel
from app.schemas.prediction import LeafPredictionResponse, PredictionItem
from app.services.treatment_knowledge import (
    build_treatment_suggestion,
    get_prevention_tips,
    get_treatment_steps,
)
from app.utils.image_preprocessing import ALLOWED_CONTENT_TYPES, preprocess_leaf_image, read_image_upload


def normalize_prediction(item: dict) -> dict:
    label = parse_label(item["label"])
    return {
        **item,
        "label": label.display_name,
        "crop_name": label.crop_name,
        "disease_name": label.disease_name,
        "category": label.category,
        "is_healthy": label.is_healthy,
        "label_details": label.to_dict(),
    }


def build_farmer_advice(label: LabelMetadata, confidence: float) -> dict:
    treatment_steps = get_treatment_steps(label)
    prevention_tips = get_prevention_tips(label)

    if label.is_healthy:
        return {
            "severity": "none",
            "summary": f"The {label.crop_name.lower()} leaf looks healthy based on the current model prediction."
            if label.crop_name != "Unknown"
            else "The leaf looks healthy based on the current model prediction.",
            "treatment_suggestion": build_treatment_suggestion(label),
            "next_steps": [
                *treatment_steps,
                "Keep leaves dry when possible to reduce fungal risk.",
            ],
            "prevention_tips": prevention_tips,
            "safety_note": "This AI result is a screening tool. Recheck if symptoms appear later.",
            "crop_name": label.crop_name,
            "disease_category": label.category,
        }

    severity = "needs_attention" if confidence >= 0.65 else "uncertain"
    return {
        "severity": severity,
        "summary": f"The model detected signs that may match {label.display_name}.",
        "treatment_suggestion": build_treatment_suggestion(label),
        "next_steps": [
            "Inspect 5-10 nearby plants to see if symptoms are spreading.",
            *treatment_steps,
            "Ask a local agronomist before applying chemical pesticide or fungicide.",
        ],
        "prevention_tips": prevention_tips,
        "safety_note": "Use protective gear and follow label instructions for any chemical treatment.",
        "crop_name": label.crop_name,
        "disease_category": label.category,
    }


class PredictionService:
    def __init__(self, settings: Settings, model: TensorFlowLeafModel):
        self.settings = settings
        self.model = model

    async def predict_leaf_disease(self, file: UploadFile) -> LeafPredictionResponse:
        started = perf_counter()
        image_bytes = await read_image_upload(
            file,
            max_image_bytes=self.settings.max_image_bytes,
            allowed_content_types=ALLOWED_CONTENT_TYPES,
        )
        batch, image_metadata = preprocess_leaf_image(image_bytes, self.settings.image_size)

        predictions = [
            normalize_prediction(item)
            for item in self.model.predict(batch, top_k=self.settings.top_k_predictions)
        ]
        top_prediction = predictions[0]
        top_label = LabelMetadata(**top_prediction["label_details"])
        advice = build_farmer_advice(
            top_label,
            top_prediction["confidence"],
        )
        processing_ms = int((perf_counter() - started) * 1000)

        return LeafPredictionResponse(
            model_loaded=self.model.is_loaded,
            crop_name=top_label.crop_name,
            crop_category=top_label.category,
            disease_name=top_label.disease_name,
            confidence_score=top_prediction["confidence"],
            severity=advice["severity"],
            treatment_suggestion=advice["treatment_suggestion"],
            prevention_tips=advice["prevention_tips"],
            label_details=top_label.to_dict(),
            prediction=PredictionItem(**top_prediction),
            top_predictions=[PredictionItem(**item) for item in predictions],
            image={
                **image_metadata,
                "filename": file.filename,
                "content_type": file.content_type,
                "bytes": len(image_bytes),
            },
            advice=advice,
            processing_ms=processing_ms,
        )
