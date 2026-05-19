import json
from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables or .env."""

    app_name: str = "AgroMind AI Prediction Service"
    app_env: str = "development"
    api_prefix: str = "/api/v1"
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:8081,http://localhost:19006",
        description="Comma-separated frontend origins allowed to call the API.",
    )

    ai_model_path: Path = Path("models/leaf_disease_model.keras")
    ai_class_names_path: Path = Path("models/class_names.json")
    ai_model_metadata_path: Path = Path("models/model_metadata.json")
    ai_class_names: str = Field(
        default="Tomato___healthy,Tomato___Early_blight,Tomato___Late_blight,Apple___Apple_scab,Corn___Common_rust",
        description="Comma-separated labels matching the model output order.",
    )
    image_size: int = 224
    max_image_bytes: int = 8 * 1024 * 1024
    top_k_predictions: int = 5
    enable_model_warmup: bool = True
    enable_demo_fallback: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def class_names(self) -> list[str]:
        if self.ai_class_names_path.exists():
            with self.ai_class_names_path.open("r", encoding="utf-8") as file:
                names = json.load(file)
            if isinstance(names, list) and all(isinstance(name, str) for name in names):
                return names
            if isinstance(names, list) and all(isinstance(item, dict) for item in names):
                labels = [
                    item.get("label") or item.get("raw_label") or item.get("class_name")
                    for item in names
                ]
                if all(isinstance(label, str) for label in labels):
                    return labels

        return [name.strip() for name in self.ai_class_names.split(",") if name.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
