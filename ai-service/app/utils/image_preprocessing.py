from io import BytesIO

import numpy as np
from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

try:
    from pillow_heif import register_heif_opener

    register_heif_opener()
except ImportError:  # pragma: no cover - optional format support
    pass


ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}
MAX_IMAGE_BYTES = 8 * 1024 * 1024


class ImageValidationError(ValueError):
    """Raised when the uploaded image cannot be used for prediction."""


async def read_image_upload(file: UploadFile) -> bytes:
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise ImageValidationError(
            f"Unsupported file type '{file.content_type}'. Upload JPEG, PNG, WebP, HEIC, or HEIF."
        )

    payload = await file.read()
    if not payload:
        raise ImageValidationError("Uploaded image is empty.")
    if len(payload) > MAX_IMAGE_BYTES:
        raise ImageValidationError("Image is too large. Maximum size is 8 MB.")

    return payload


def load_pil_image(image_bytes: bytes) -> Image.Image:
    try:
        image = Image.open(BytesIO(image_bytes))
        image.load()
        image = ImageOps.exif_transpose(image)
        return image.convert("RGB")
    except (UnidentifiedImageError, OSError) as exc:
        raise ImageValidationError("Could not read the uploaded image.") from exc


def preprocess_leaf_image(image_bytes: bytes, image_size: int) -> tuple[np.ndarray, dict]:
    """Convert raw bytes into a normalized TensorFlow-ready batch tensor."""

    image = load_pil_image(image_bytes)
    original_width, original_height = image.size
    resized = ImageOps.fit(
        image,
        (image_size, image_size),
        method=Image.Resampling.BILINEAR,
        centering=(0.5, 0.5),
    )

    array = np.asarray(resized, dtype=np.float32) / 255.0
    batch = np.expand_dims(array, axis=0)

    metadata = {
        "original_width": original_width,
        "original_height": original_height,
        "model_width": image_size,
        "model_height": image_size,
        "channels": 3,
    }

    return batch, metadata
