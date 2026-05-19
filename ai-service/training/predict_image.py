"""Run a local prediction with a saved AgroMind TensorFlow model.

This is useful for testing a saved model before wiring it into FastAPI.

Run from ai-service:
  python -m training.predict_image --image dataset/Tomato_healthy/example.jpg
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.core.config import get_settings
from app.model.label_metadata import parse_label
from app.model.tensorflow_model import TensorFlowLeafModel
from app.utils.image_preprocessing import preprocess_leaf_image


def parse_args() -> argparse.Namespace:
    settings = get_settings()
    parser = argparse.ArgumentParser(
        description="Predict plant disease from a local image using a saved AgroMind model."
    )
    parser.add_argument("--image", type=Path, required=True)
    parser.add_argument("--model-path", type=Path, default=settings.ai_model_path)
    parser.add_argument("--class-names-path", type=Path, default=settings.ai_class_names_path)
    parser.add_argument("--metadata-path", type=Path, default=settings.ai_model_metadata_path)
    parser.add_argument("--image-size", type=int, default=settings.image_size)
    parser.add_argument("--top-k", type=int, default=settings.top_k_predictions)
    return parser.parse_args()


def load_class_names(path: Path) -> list[str]:
    if not path.exists():
        return get_settings().class_names

    with path.open("r", encoding="utf-8") as file:
        payload = json.load(file)

    if not isinstance(payload, list) or not all(isinstance(item, str) for item in payload):
        raise ValueError(f"Class names file must be a JSON string list: {path}")

    return payload


def predict_image(
    image_path: Path,
    model_path: Path,
    class_names_path: Path,
    metadata_path: Path,
    image_size: int,
    top_k: int,
) -> dict:
    if not image_path.exists():
        raise FileNotFoundError(f"Image not found: {image_path}")

    class_names = load_class_names(class_names_path)
    model = TensorFlowLeafModel(
        model_path=model_path,
        class_names=class_names,
        enable_demo_fallback=False,
        image_size=image_size,
        metadata_path=metadata_path,
        warmup=True,
    )
    model.load()

    if not model.is_loaded:
        raise RuntimeError(model.load_error or f"Could not load model: {model_path}")

    batch, image_metadata = preprocess_leaf_image(image_path.read_bytes(), image_size)
    predictions = model.predict(batch, top_k=top_k)

    normalized_predictions = []
    for item in predictions:
        label = parse_label(item["label"])
        normalized_predictions.append(
            {
                "label": label.display_name,
                "raw_label": label.raw_label,
                "crop_name": label.crop_name,
                "disease_name": label.disease_name,
                "category": label.category,
                "is_healthy": label.is_healthy,
                "confidence": item["confidence"],
            }
        )

    top_prediction = normalized_predictions[0]
    return {
        "success": True,
        "model": model.status,
        "image": {
            "path": str(image_path),
            **image_metadata,
        },
        "prediction": top_prediction,
        "confidence_score": top_prediction["confidence"],
        "top_predictions": normalized_predictions,
    }


def main() -> None:
    args = parse_args()
    result = predict_image(
        image_path=args.image,
        model_path=args.model_path,
        class_names_path=args.class_names_path,
        metadata_path=args.metadata_path,
        image_size=args.image_size,
        top_k=args.top_k,
    )
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
