import io
import numpy as np
from PIL import Image
from fastapi import HTTPException

# Match the target size used during training
TARGET_SIZE = (224, 224)

def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """
    Preprocesses an uploaded image byte stream into a format suitable for MobileNetV2.
    
    CRITICAL: This pipeline strictly mirrors the training pipeline:
    1. Resizes image to 224x224
    2. Keeps pixel values in the range [0, 255]
       (The model has an internal Rescaling layer that maps this to [-1, 1])
    3. Adds a batch dimension
    """
    try:
        # Load image from bytes using Pillow
        img = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB in case of RGBA or Grayscale images
        if img.mode != "RGB":
            img = img.convert("RGB")
            
        # Resize image using LANCZOS (high quality downsampling)
        img = img.resize(TARGET_SIZE, Image.Resampling.LANCZOS)
        
        # Convert to numpy array
        img_array = np.array(img)
        
        # Ensure it's float32
        img_array = img_array.astype(np.float32)
        
        # DO NOT divide by 255. The MobileNetV2 Rescaling layer expects [0, 255]
        
        # Expand dimensions to create a batch of 1: (1, 224, 224, 3)
        img_array = np.expand_dims(img_array, axis=0)
        
        return img_array

    except Exception as e:
        # Catch corrupted or invalid image files
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid image format or corrupted file. Error: {str(e)}"
        )
