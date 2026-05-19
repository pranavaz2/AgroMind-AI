# 🤖 AI Model Details

This document details the machine learning lifecycle for the AgroMind AI crop disease classifier.

## 1. Dataset & Preprocessing
The model was trained on a dataset containing distinct classes (e.g., Tomato Early Blight, Potato Healthy, etc.).

### Preprocessing Bug Fix
During early development, the model plateaued at exactly 33.8% accuracy. We diagnosed a **Double Normalization Bug**:
1. `tf.keras.utils.image_dataset_from_directory` loaded images as float32 in the `[0, 255]` range.
2. A legacy preprocessing function was dividing arrays by `255.0` to force them into a `[0, 1]` range.
3. The MobileNetV2 architecture expects `[0, 255]` inputs because its internal `Rescaling` layer maps inputs to `[-1, 1]` based on ImageNet stats.
4. By passing `[0, 1]` data into a `Rescaling` layer, all pixel values collapsed to approximately `-1.0`, destroying feature extraction.

Removing the manual `1/255` scaling resolved the issue entirely.

## 2. Augmentation Strategy
To prevent overfitting on the small dataset, we implemented a conservative augmentation pipeline:
- `RandomFlip("horizontal")`
- `RandomRotation(0.10)`
- `RandomZoom(0.10)`
- `RandomContrast(0.10)`

*Note: Vertical flipping was removed because plants have a distinct top-to-bottom orientation (gravity), and vertical flips confused the model.*

## 3. Transfer Learning & Architecture
We used **MobileNetV2** pre-trained on ImageNet.

### Classification Head
We removed the original 1000-class head and added a streamlined custom head:
```python
GlobalAveragePooling2D()
BatchNormalization()
Dense(128, activation='relu')
Dropout(0.3)
Dense(num_classes, activation='softmax')
```

### Freezing BatchNormalization
During fine-tuning, it is critical that `BatchNormalization` layers remain frozen (`layer.trainable = False`). If unfrozen, they update their moving mean and variance based on the small training batches, which destroys the robust statistics learned from ImageNet, causing erratic validation accuracy.

## 4. Evaluation Metrics
Following hyperparameter tuning, our final `.keras` model achieved:
- **Validation Accuracy**: 98.35%
- **Top-3 Accuracy**: 100.0%

## 5. Confidence Handling in Production
The FastAPI service utilizes `softmax` outputs. The Node.js orchestrator normalizes this to a percentage. In the React Native frontend, if the confidence drops below **70%**, a strict guardrail warning is displayed to the farmer, advising them to retake the photo. This prevents "hallucinated" diagnoses on blurry or unrelated images.
