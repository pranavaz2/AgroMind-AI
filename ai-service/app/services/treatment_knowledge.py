from app.model.label_metadata import LabelMetadata


CROP_TREATMENT_GUIDES = {
    "tomato": {
        "fungal": [
            "Remove badly infected leaves and avoid overhead irrigation.",
            "Improve airflow by spacing plants and pruning dense foliage.",
            "Ask a local agronomist about an appropriate fungicide for tomato in your region.",
        ],
        "bacterial": [
            "Avoid working in the crop when leaves are wet.",
            "Remove infected plant debris away from the field.",
            "Use copper-based treatment only with local agronomist guidance.",
        ],
        "viral": [
            "Remove severely affected plants to reduce spread.",
            "Control whiteflies, aphids, and other insect vectors.",
            "Use resistant varieties and clean seedlings for the next planting.",
        ],
    },
    "potato": {
        "fungal": [
            "Remove infected foliage where practical and keep rows well ventilated.",
            "Avoid wet leaves late in the day.",
            "Confirm with an agronomist before applying potato blight fungicide.",
        ],
    },
    "apple": {
        "fungal": [
            "Prune crowded branches to increase airflow.",
            "Remove fallen infected leaves and fruit from the orchard floor.",
            "Use a locally recommended orchard spray schedule after expert confirmation.",
        ],
    },
    "corn": {
        "fungal": [
            "Scout nearby plants and note whether lesions are spreading upward.",
            "Avoid excessive nitrogen and manage crop residue after harvest.",
            "Consult an agronomist about hybrid resistance and fungicide timing.",
        ],
    },
    "grape": {
        "fungal": [
            "Open the canopy to improve sunlight and airflow.",
            "Remove infected leaves or clusters when practical.",
            "Use a vineyard-specific spray program only after local expert confirmation.",
        ],
    },
}


GENERIC_TREATMENTS = {
    "fungal": [
        "Remove heavily infected leaves where practical.",
        "Reduce leaf wetness by watering near the soil.",
        "Ask a local agronomist before applying fungicide.",
    ],
    "bacterial": [
        "Avoid splashing water from infected leaves to healthy leaves.",
        "Disinfect tools after working with affected plants.",
        "Confirm the diagnosis before using copper or antibiotic-based products.",
    ],
    "viral": [
        "Remove severely affected plants if symptoms are spreading.",
        "Control insect vectors and weeds around the crop.",
        "Use certified clean seed or seedlings for the next crop cycle.",
    ],
    "unknown": [
        "Inspect nearby plants and compare symptoms before treatment.",
        "Take another clear close-up photo if the result confidence is low.",
        "Ask a local agronomist before applying any pesticide.",
    ],
}


CROP_PREVENTION_GUIDES = {
    "tomato": [
        "Water at soil level and avoid wetting leaves.",
        "Space plants well and prune dense foliage for airflow.",
        "Remove old infected leaves and crop debris from the field.",
    ],
    "potato": [
        "Use healthy seed tubers from a trusted source.",
        "Avoid overhead irrigation late in the day.",
        "Rotate potato crops to reduce disease buildup in soil.",
    ],
    "apple": [
        "Prune trees to keep the canopy open and dry.",
        "Remove fallen leaves and infected fruit after harvest.",
        "Use resistant varieties where available.",
    ],
    "corn": [
        "Rotate crops and manage infected residue after harvest.",
        "Choose resistant hybrids when disease pressure is common.",
        "Scout fields regularly during humid weather.",
    ],
    "grape": [
        "Keep the canopy open for sunlight and airflow.",
        "Avoid excess irrigation around vines.",
        "Remove infected plant material from the vineyard.",
    ],
}


GENERIC_PREVENTION_TIPS = {
    "healthy": [
        "Continue regular crop scouting.",
        "Keep leaves dry when possible.",
        "Maintain balanced irrigation and nutrition.",
    ],
    "fungal": [
        "Reduce leaf wetness by watering near the soil.",
        "Improve airflow around plants.",
        "Remove infected debris after pruning or harvest.",
    ],
    "bacterial": [
        "Avoid handling plants when leaves are wet.",
        "Disinfect tools between infected and healthy plants.",
        "Avoid splash irrigation where disease is present.",
    ],
    "viral": [
        "Control insect vectors such as aphids and whiteflies.",
        "Remove severely affected plants when spread is likely.",
        "Use clean seed or seedlings for the next planting.",
    ],
    "unknown": [
        "Take clear close-up photos from multiple leaves.",
        "Monitor nearby plants for similar symptoms.",
        "Confirm unusual symptoms with a local agronomist.",
    ],
}


def _crop_key(crop_name: str) -> str:
    return crop_name.lower().strip()


def get_treatment_steps(label: LabelMetadata) -> list[str]:
    if label.is_healthy:
        return [
            "No disease treatment is recommended right now.",
            "Continue routine field monitoring.",
            "Maintain balanced irrigation and nutrition.",
        ]

    crop_guide = CROP_TREATMENT_GUIDES.get(_crop_key(label.crop_name), {})
    return crop_guide.get(label.category) or GENERIC_TREATMENTS.get(
        label.category,
        GENERIC_TREATMENTS["unknown"],
    )


def get_prevention_tips(label: LabelMetadata) -> list[str]:
    crop_tips = CROP_PREVENTION_GUIDES.get(_crop_key(label.crop_name), [])
    category = "healthy" if label.is_healthy else label.category
    generic_tips = GENERIC_PREVENTION_TIPS.get(category, GENERIC_PREVENTION_TIPS["unknown"])

    tips = [*crop_tips, *generic_tips]
    deduplicated = list(dict.fromkeys(tips))
    return deduplicated[:5]


def build_treatment_suggestion(label: LabelMetadata) -> str:
    if label.is_healthy:
        crop_context = "" if label.crop_name == "Unknown" else f" for {label.crop_name}"
        return f"No disease treatment is recommended{crop_context}. Keep monitoring and maintain good crop hygiene."

    steps = get_treatment_steps(label)
    crop_context = "this crop" if label.crop_name == "Unknown" else label.crop_name
    return (
        f"For {crop_context}, the model detected {label.disease_name}. "
        f"{steps[0]} Confirm locally before applying chemical treatment."
    )
