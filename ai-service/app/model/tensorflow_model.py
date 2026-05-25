from pathlib import Path

import numpy as np


class TensorFlowLeafModel:
    """Small adapter around TensorFlow so the rest of the app stays clean."""

    def __init__(self, model_path: Path, class_names: list[str], enable_demo_fallback: bool):
        self.model_path = model_path
        self.class_names = class_names
        self.enable_demo_fallback = enable_demo_fallback
        self.model = None
        self.load_error: str | None = None

    @property
    def is_loaded(self) -> bool:
        return self.model is not None

    def load(self) -> None:
        if not self.model_path.exists():
            self.load_error = f"Model file not found: {self.model_path}"
            return

        try:
            import tensorflow as tf

            self.model = tf.keras.models.load_model(self.model_path)
            self.load_error = None
        except Exception as exc:  # pragma: no cover - startup safety
            self.model = None
            self.load_error = str(exc)

    def predict(self, batch: np.ndarray) -> list[dict]:
        if self.model is None:
            if not self.enable_demo_fallback:
                raise RuntimeError(self.load_error or "TensorFlow model is not loaded.")
            probabilities = self._demo_predict(batch)
        else:
            raw = self.model.predict(batch, verbose=0)
            probabilities = self._normalize_probabilities(raw)

        top_indices = np.argsort(probabilities)[::-1]
        return [
            {
                "label": self.class_names[index] if index < len(self.class_names) else f"Class {index}",
                "confidence": float(probabilities[index]),
            }
            for index in top_indices[: min(5, len(top_indices))]
        ]

    def _normalize_probabilities(self, raw_prediction) -> np.ndarray:
        values = np.asarray(raw_prediction)[0].astype(np.float64)

        if values.ndim != 1:
            values = values.reshape(-1)

        if np.any(values < 0) or not np.isclose(values.sum(), 1.0, atol=1e-3):
            exp_values = np.exp(values - np.max(values))
            values = exp_values / exp_values.sum()

        return values

    def _demo_predict(self, batch: np.ndarray) -> np.ndarray:
        """Deterministic fallback for local API testing before a real model exists."""

        brightness = float(batch.mean())
        green_signal = float(batch[..., 1].mean() - batch[..., 0].mean())
        class_count = max(len(self.class_names), 1)
        scores = np.linspace(0.2, 0.8, class_count)

        if class_count > 0:
            scores[0] = 0.75 if green_signal > 0.02 and brightness > 0.25 else 0.2
        if class_count > 1:
            scores[1] = 0.6 if brightness < 0.35 else 0.25
        if class_count > 2:
            scores[2] = 0.65 if green_signal < -0.02 else 0.22

        exp_scores = np.exp(scores - np.max(scores))
        return exp_scores / exp_scores.sum()
