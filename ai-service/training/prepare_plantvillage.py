"""Prepare PlantVillage for repeatable AgroMind training.

Raw input:
  data/raw/plantvillage/Tomato___healthy/*.jpg

Prepared output:
  data/processed/plantvillage/
    train/Tomato___healthy/*.jpg
    validation/Tomato___healthy/*.jpg
    test/Tomato___healthy/*.jpg
    dataset_manifest.csv
    dataset_report.json
"""

from __future__ import annotations

import argparse
import csv
import json
import random
import shutil
from dataclasses import asdict, dataclass
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


@dataclass(frozen=True)
class DatasetPrepConfig:
    raw_dir: Path
    output_dir: Path = Path("data/processed/plantvillage")
    image_size: int = 224
    train_ratio: float = 0.7
    validation_ratio: float = 0.15
    test_ratio: float = 0.15
    seed: int = 42
    min_images_per_class: int = 10
    clean: bool = False
    normalize_labels: bool = False


def parse_args() -> DatasetPrepConfig:
    parser = argparse.ArgumentParser(
        description="Clean, resize, and split PlantVillage into train/validation/test folders."
    )
    parser.add_argument("--raw-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("data/processed/plantvillage"))
    parser.add_argument("--image-size", type=int, default=224)
    parser.add_argument("--train-ratio", type=float, default=0.7)
    parser.add_argument("--validation-ratio", type=float, default=0.15)
    parser.add_argument("--test-ratio", type=float, default=0.15)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--min-images-per-class", type=int, default=10)
    parser.add_argument("--clean", action="store_true")
    parser.add_argument(
        "--normalize-labels",
        action="store_true",
        help=(
            "Convert common folder names like Tomato_Early_blight into "
            "PlantVillage-style labels like Tomato___Early_blight."
        ),
    )
    args = parser.parse_args()

    return DatasetPrepConfig(
        raw_dir=args.raw_dir,
        output_dir=args.output_dir,
        image_size=args.image_size,
        train_ratio=args.train_ratio,
        validation_ratio=args.validation_ratio,
        test_ratio=args.test_ratio,
        seed=args.seed,
        min_images_per_class=args.min_images_per_class,
        clean=args.clean,
        normalize_labels=args.normalize_labels,
    )


def validate_ratios(config: DatasetPrepConfig) -> None:
    total = config.train_ratio + config.validation_ratio + config.test_ratio
    if abs(total - 1.0) > 1e-6:
        raise ValueError("Split ratios must add up to 1.0.")
    if config.image_size < 32:
        raise ValueError("image_size must be at least 32 pixels.")


def find_class_dirs(raw_dir: Path) -> list[Path]:
    if not raw_dir.exists():
        raise FileNotFoundError(f"Raw dataset folder not found: {raw_dir}")
    class_dirs = sorted(path for path in raw_dir.iterdir() if path.is_dir())
    if len(class_dirs) < 2:
        raise ValueError("raw_dir must contain one folder per disease class.")
    return class_dirs


def list_images(class_dir: Path) -> list[Path]:
    return sorted(
        path
        for path in class_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
    )


def normalize_class_name(class_name: str) -> str:
    """Return a serving-friendly Crop___Disease label when possible.

    PlantVillage normally uses Crop___Disease_name. Some local downloads use
    names like Tomato_Early_blight. The API can parse the triple-underscore
    format more reliably, so preparation can normalize the copied output.
    """

    if "___" in class_name:
        return class_name

    parts = class_name.split("_")
    if len(parts) >= 2:
        crop = parts[0]
        disease = "_".join(parts[1:])
        return f"{crop}___{disease}"

    return class_name


def split_images(images: list[Path], config: DatasetPrepConfig) -> dict[str, list[Path]]:
    shuffled = images[:]
    random.Random(config.seed).shuffle(shuffled)

    total = len(shuffled)
    train_count = int(total * config.train_ratio)
    validation_count = int(total * config.validation_ratio)

    train = shuffled[:train_count]
    validation = shuffled[train_count : train_count + validation_count]
    test = shuffled[train_count + validation_count :]

    return {
        "train": train,
        "validation": validation,
        "test": test,
    }


def prepare_image(source: Path, destination: Path, image_size: int) -> tuple[int, int]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image)
        image = image.convert("RGB")
        original_size = image.size
        image = ImageOps.fit(
            image,
            (image_size, image_size),
            method=Image.Resampling.BILINEAR,
            centering=(0.5, 0.5),
        )
        image.save(destination, format="JPEG", quality=92, optimize=True)
    return original_size


def safe_filename(source: Path, index: int) -> str:
    stem = "".join(char if char.isalnum() or char in ("-", "_") else "_" for char in source.stem)
    return f"{index:05d}_{stem}.jpg"


def write_manifest(manifest_rows: list[dict], output_dir: Path) -> None:
    manifest_path = output_dir / "dataset_manifest.csv"
    with manifest_path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=[
                "split",
                "class_name",
                "source_class_name",
                "source_path",
                "prepared_path",
                "original_width",
                "original_height",
                "prepared_width",
                "prepared_height",
            ],
        )
        writer.writeheader()
        writer.writerows(manifest_rows)


def write_report(config: DatasetPrepConfig, report: dict, output_dir: Path) -> None:
    serializable_config = asdict(config)
    serializable_config["raw_dir"] = str(config.raw_dir)
    serializable_config["output_dir"] = str(config.output_dir)
    payload = {
        "config": serializable_config,
        **report,
    }
    with (output_dir / "dataset_report.json").open("w", encoding="utf-8") as file:
        json.dump(payload, file, indent=2)


def prepare_dataset(config: DatasetPrepConfig) -> None:
    validate_ratios(config)
    class_dirs = find_class_dirs(config.raw_dir)

    if config.clean and config.output_dir.exists():
        shutil.rmtree(config.output_dir)
    config.output_dir.mkdir(parents=True, exist_ok=True)

    manifest_rows = []
    report = {
        "class_count": len(class_dirs),
        "total_images": 0,
        "skipped_images": [],
        "splits": {
            "train": {},
            "validation": {},
            "test": {},
        },
    }

    for class_dir in class_dirs:
        source_class_name = class_dir.name
        class_name = (
            normalize_class_name(source_class_name)
            if config.normalize_labels
            else source_class_name
        )
        images = list_images(class_dir)
        if len(images) < config.min_images_per_class:
            raise ValueError(
                f"Class '{source_class_name}' only has {len(images)} images. "
                f"Minimum required is {config.min_images_per_class}."
            )

        split_map = split_images(images, config)

        for split_name, split_images_for_class in split_map.items():
            report["splits"][split_name][class_name] = 0

            for index, source in enumerate(split_images_for_class):
                destination = (
                    config.output_dir
                    / split_name
                    / class_name
                    / safe_filename(source, index)
                )
                try:
                    original_width, original_height = prepare_image(
                        source,
                        destination,
                        config.image_size,
                    )
                except (UnidentifiedImageError, OSError) as exc:
                    report["skipped_images"].append(
                        {
                            "path": str(source),
                            "reason": str(exc),
                        }
                    )
                    continue

                report["splits"][split_name][class_name] += 1
                report["total_images"] += 1
                manifest_rows.append(
                    {
                        "split": split_name,
                        "class_name": class_name,
                        "source_class_name": source_class_name,
                        "source_path": str(source),
                        "prepared_path": str(destination),
                        "original_width": original_width,
                        "original_height": original_height,
                        "prepared_width": config.image_size,
                        "prepared_height": config.image_size,
                    }
                )

    write_manifest(manifest_rows, config.output_dir)
    write_report(config, report, config.output_dir)

    print("\nDataset prepared successfully.")
    print(f"Output: {config.output_dir}")
    print(f"Classes: {report['class_count']}")
    print(f"Images: {report['total_images']}")
    print(f"Skipped: {len(report['skipped_images'])}")
    print(f"Manifest: {config.output_dir / 'dataset_manifest.csv'}")
    print(f"Report: {config.output_dir / 'dataset_report.json'}")


def main() -> None:
    prepare_dataset(parse_args())


if __name__ == "__main__":
    main()
