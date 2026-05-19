import json
from pathlib import Path
from typing import Any

import numpy as np


class TensorFlowLeafModel:
    """Small adapter around TensorFlow so the rest of the app stays clean."""

    def __init__(
        self,
        model_path: Path,
        class_names: list[str],
        enable_demo_fallback: bool,
        image_size: int = 224,
        metadata_path: Path | None = None,
        warmup: bool = True,
    ):
        self.model_path = model_path
        self.class_names = class_names
        self.enable_demo_fallback = enable_demo_fallback
        self.image_size = image_size
        self.metadata_path = metadata_path
        self.warmup = warmup
        self.model = None
        self.inference_fn = None
        self.interpreter = None
        self.input_details = None
        self.output_details = None
        self.metadata: dict[str, Any] = {}
        self.load_error: str | None = None

    @property
    def is_loaded(self) -> bool:
        return self.model is not None or self.interpreter is not None

    @property
    def status(self) -> dict[str, Any]:
        return {
            "model_path": str(self.model_path),
            "metadata_path": str(self.metadata_path) if self.metadata_path else None,
            "loaded": self.is_loaded,
            "load_error": self.load_error,
            "class_count": len(self.class_names),
            "runtime": self._runtime_name(),
            "demo_fallback_enabled": self.enable_demo_fallback,
            "image_size": self.image_size,
            "metadata": self.metadata,
        }

    def load(self) -> None:
        if not self.model_path.exists():
            self.load_error = f"Model file not found: {self.model_path}"
            self._load_metadata()
            return

        try:
            import tensorflow as tf

            if self.model_path.suffix.lower() == ".tflite":
                self._load_tflite(tf)
            else:
                self.model = tf.keras.models.load_model(self.model_path, compile=False)
                self.inference_fn = tf.function(
                    lambda images: self.model(images, training=False),
                    reduce_retracing=True,
                )
            self._load_metadata()
            if self.warmup:
                self._warmup()
            self.load_error = None
        except Exception as exc:  # pragma: no cover - startup safety
            self.model = None
            self.inference_fn = None
            self.interpreter = None
            self.input_details = None
            self.output_details = None
            self.load_error = str(exc)

    def _runtime_name(self) -> str:
        if self.interpreter is not None:
            return "tflite"
        if self.model is not None:
            return "keras"
        return "unloaded"

    def predict(self, batch: np.ndarray, top_k: int = 5) -> list[dict]:
        if self.model is None and self.interpreter is None:
            if not self.enable_demo_fallback:
                raise RuntimeError(self.load_error or "TensorFlow model is not loaded.")
            probabilities = self._demo_predict(batch)
        else:
            raw = self._run_inference(batch)
            probabilities = self._normalize_probabilities(raw)

        top_indices = np.argsort(probabilities)[::-1]
        limit = max(1, min(top_k, len(top_indices)))
        return [
            {
                "label": self.class_names[index] if index < len(self.class_names) else f"Class {index}",
                "confidence": float(probabilities[index]),
            }
            for index in top_indices[:limit]
        ]

    def _load_tflite(self, tf) -> None:
        self.interpreter = tf.lite.Interpreter(model_path=str(self.model_path))
        self.interpreter.allocate_tensors()
        self.input_details = self.interpreter.get_input_details()[0]
        self.output_details = self.interpreter.get_output_details()[0]

    def _run_inference(self, batch: np.ndarray) -> np.ndarray:
        if self.interpreter is not None:
            return self._run_tflite_inference(batch)

        if self.inference_fn is None:
            raise RuntimeError("TensorFlow inference function is not initialized.")

        import tensorflow as tf

        tensor = tf.convert_to_tensor(batch, dtype=tf.float32)
        outputs = self.inference_fn(tensor)
        return outputs.numpy()

    def _run_tflite_inference(self, batch: np.ndarray) -> np.ndarray:
        if self.input_details is None or self.output_details is None:
            raise RuntimeError("TensorFlow Lite interpreter is not initialized.")

        input_index = self.input_details["index"]
        input_dtype = self.input_details["dtype"]
        prepared = batch

        if np.issubdtype(input_dtype, np.integer):
            scale, zero_point = self.input_details["quantization"]
            if scale and scale > 0:
                prepared = np.round(batch / scale + zero_point)
            prepared = np.clip(
                prepared,
                np.iinfo(input_dtype).min,
                np.iinfo(input_dtype).max,
            ).astype(input_dtype)
        else:
            prepared = batch.astype(input_dtype)

        self.interpreter.set_tensor(input_index, prepared)
        self.interpreter.invoke()
        output = self.interpreter.get_tensor(self.output_details["index"])

        output_dtype = self.output_details["dtype"]
        if np.issubdtype(output_dtype, np.integer):
            scale, zero_point = self.output_details["quantization"]
            if scale and scale > 0:
                output = (output.astype(np.float32) - zero_point) * scale

        return output

    def _warmup(self) -> None:
        dummy_batch = np.zeros(
            (1, self.image_size, self.image_size, 3),
            dtype=np.float32,
        )
        self._run_inference(dummy_batch)

    def _load_metadata(self) -> None:
        if not self.metadata_path or not self.metadata_path.exists():
            self.metadata = {}
            return

        try:
            with self.metadata_path.open("r", encoding="utf-8") as file:
                payload = json.load(file)
            self.metadata = payload if isinstance(payload, dict) else {}
        except (OSError, json.JSONDecodeError):
            self.metadata = {}

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
