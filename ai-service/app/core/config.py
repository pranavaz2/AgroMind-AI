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

    ai_model_path: Path = Path("models/leaf_disease_model.keras")
    ai_class_names_path: Path = Path("models/class_names.json")
    ai_class_names: str = Field(
        default="Healthy,Early Blight,Late Blight,Leaf Spot,Rust",
        description="Comma-separated labels matching the model output order.",
    )
    image_size: int = 224
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

        return [name.strip() for name in self.ai_class_names.split(",") if name.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
