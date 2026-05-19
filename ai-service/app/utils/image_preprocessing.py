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


async def read_image_upload(
    file: UploadFile,
    max_image_bytes: int = MAX_IMAGE_BYTES,
    allowed_content_types: set[str] | None = None,
) -> bytes:
    content_types = allowed_content_types or ALLOWED_CONTENT_TYPES
    if file.content_type not in content_types:
        raise ImageValidationError(
            f"Unsupported file type '{file.content_type}'. Upload JPEG, PNG, WebP, HEIC, or HEIF."
        )

    payload = await file.read()
    if not payload:
        raise ImageValidationError("Uploaded image is empty.")
    if len(payload) > max_image_bytes:
        max_mb = max_image_bytes / (1024 * 1024)
        raise ImageValidationError(f"Image is too large. Maximum size is {max_mb:g} MB.")

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
        "preprocessing": {
            "orientation": "exif_transposed",
            "color_mode": "RGB",
            "resize": "center_crop",
            "normalization": "float32_0_to_1",
            "batch_shape": [1, image_size, image_size, 3],
        },
    }

    return batch, metadata
