from dataclasses import asdict, dataclass
import re


HEALTHY_TERMS = {"healthy", "normal", "no disease", "none"}


@dataclass(frozen=True)
class LabelMetadata:
    raw_label: str
    crop_name: str
    disease_name: str
    display_name: str
    is_healthy: bool
    category: str

    def to_dict(self) -> dict:
        return asdict(self)


def _humanize(value: str) -> str:
    cleaned = re.sub(r"[_-]+", " ", value).strip()
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.title() if cleaned else "Unknown"


def parse_label(label: str) -> LabelMetadata:
    """Parse flat model labels into crop and disease metadata.

    Supports common dataset label formats:
    - PlantVillage: Tomato___Late_blight
    - Display labels: Tomato - Late blight
    - Generic single labels: Rust, Healthy
    """

    raw_label = label.strip() if label else "Unknown"

    if "___" in raw_label:
        crop_part, disease_part = raw_label.split("___", 1)
    elif " - " in raw_label:
        crop_part, disease_part = raw_label.split(" - ", 1)
    elif "__" in raw_label:
        crop_part, disease_part = raw_label.split("__", 1)
    else:
        crop_part, disease_part = "Unknown", raw_label

    crop_name = _humanize(crop_part)
    disease_name = _humanize(disease_part)
    normalized_disease = disease_name.lower()
    is_healthy = normalized_disease in HEALTHY_TERMS or "healthy" in normalized_disease
    disease_name = "Healthy" if is_healthy else disease_name

    if is_healthy:
        category = "healthy"
    elif any(term in normalized_disease for term in ("blight", "rot", "mold", "mildew", "scab")):
        category = "fungal"
    elif any(term in normalized_disease for term in ("virus", "mosaic", "curl")):
        category = "viral"
    elif any(term in normalized_disease for term in ("spot", "speck", "bacterial")):
        category = "bacterial"
    elif "rust" in normalized_disease:
        category = "fungal"
    else:
        category = "unknown"

    display_name = disease_name if crop_name == "Unknown" else f"{crop_name} - {disease_name}"

    return LabelMetadata(
        raw_label=raw_label,
        crop_name=crop_name,
        disease_name=disease_name,
        display_name=display_name,
        is_healthy=is_healthy,
        category=category,
    )
