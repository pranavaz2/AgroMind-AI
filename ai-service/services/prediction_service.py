import os
import json
import time
import numpy as np
import tensorflow as tf
import logging

logger = logging.getLogger("uvicorn.error")

# Constants for model loading
MODEL_PATH = os.path.join("models", "plant_disease_model.keras")
CLASS_NAMES_PATH = os.path.join("models", "class_names.json")

# Global variables to hold the loaded model and class names
# We load them ONCE during startup to prevent high latency on predictions
_model = None
_class_names = []

# Knowledge base for providing treatment and prevention tips
DISEASE_KNOWLEDGE = {
    "Potato___Early_blight": {
        "severity": "High",
        "treatment": "Apply fungicides containing chlorothalonil or mancozeb. Remove infected lower leaves.",
        "prevention": "Practice crop rotation. Ensure adequate plant spacing for airflow."
    },
    "Potato___healthy": {
        "severity": "None",
        "treatment": "No treatment required.",
        "prevention": "Continue standard maintenance, proper watering, and monitoring."
    },
    "Tomato___Early_blight": {
        "severity": "High",
        "treatment": "Prune infected leaves immediately. Apply copper-based fungicides.",
        "prevention": "Use drip irrigation instead of overhead watering. Mulch around the base."
    },
    "Tomato___Late_blight": {
        "severity": "Critical",
        "treatment": "Immediately remove and destroy infected plants. Apply specialized late blight fungicides.",
        "prevention": "Avoid damp conditions. Ensure excellent air circulation and sunlight exposure."
    },
    "Tomato___healthy": {
        "severity": "None",
        "treatment": "No treatment required.",
        "prevention": "Continue standard maintenance, proper watering, and monitoring."
    }
}

def load_model_and_classes():
    """
    Called exactly once during FastAPI startup.
    Loads the TensorFlow .keras model and the JSON class names into memory.
    """
    global _model, _class_names
    
    if _model is not None:
        return # Already loaded
        
    try:
        logger.info(f"Loading TensorFlow model from {MODEL_PATH}...")
        _model = tf.keras.models.load_model(MODEL_PATH)
        logger.info("Model loaded successfully.")
        
        logger.info(f"Loading class names from {CLASS_NAMES_PATH}...")
        with open(CLASS_NAMES_PATH, "r") as f:
            _class_names = json.load(f)
        logger.info(f"Loaded {len(_class_names)} classes.")
        
        # Run a dummy prediction to 'warm up' the model graph
        logger.info("Warming up model...")
        dummy_input = np.zeros((1, 224, 224, 3), dtype=np.float32)
        _model.predict(dummy_input, verbose=0)
        logger.info("Model warm-up complete. Ready for inference!")
        
    except Exception as e:
        logger.error(f"Failed to load model or classes: {str(e)}")
        raise RuntimeError(f"Startup check failed: {str(e)}")

def predict_disease(image_tensor: np.ndarray) -> dict:
    """
    Runs the preprocessed image tensor through the MobileNetV2 model
    and decodes the predictions.
    """
    if _model is None or not _class_names:
        raise RuntimeError("Model has not been loaded. Is the server starting?")
        
    start_time = time.time()
    
    # 1. Run inference
    # predictions shape is (1, num_classes)
    predictions = _model.predict(image_tensor, verbose=0)
    probabilities = predictions[0] # Extract the 1D array of probabilities
    
    # 2. Get the top prediction
    top_index = np.argmax(probabilities)
    top_class = _class_names[top_index]
    top_confidence = float(probabilities[top_index])
    
    # 3. Get top 3 predictions for additional context
    top_3_indices = np.argsort(probabilities)[-3:][::-1]
    top_predictions = [
        {
            "class": _class_names[i],
            "confidence": float(probabilities[i])
        }
        for i in top_3_indices
    ]
    
    end_time = time.time()
    prediction_time_ms = int((end_time - start_time) * 1000)
    
    # 4. Fetch knowledge base info
    knowledge = DISEASE_KNOWLEDGE.get(top_class, {
        "severity": "Unknown",
        "treatment": "Consult a local agricultural expert.",
        "prevention": "Maintain standard farm hygiene."
    })
    
    # Format display name (e.g., "Tomato___Early_blight" -> "Tomato Early blight")
    display_name = top_class.replace("___", " ").replace("_", " ")
    
    # 5. Check if confidence is too low (e.g., < 50%)
    if top_confidence < 0.50:
        knowledge["severity"] = "Unknown"
        knowledge["treatment"] = "Prediction confidence is too low. Please upload a clearer picture of the leaf."
        display_name = "Unrecognized / Uncertain"
    
    # Build response dictionary
    result = {
        "disease": top_class,
        "display_name": display_name,
        "confidence": top_confidence,
        "severity": knowledge["severity"],
        "treatment": knowledge["treatment"],
        "prevention": knowledge["prevention"],
        "prediction_time_ms": prediction_time_ms,
        "top_predictions": top_predictions
    }
    
    return result
