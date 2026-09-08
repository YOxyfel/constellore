"""Build deterministic PBR atlases for the Moon Settlement field kit.

The four professionally generated source swatches are art inputs, not runtime
textures. This script normalizes their baked illumination, derives restrained
physical surface maps, preserves the existing 4x4 material-role UV contract,
and emits both shared runtime and small embedded texture tiers.

Only Pillow and NumPy are required so the processor can run before Blender.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps


CONTRACT_NAME = "constellore-moon-settlement-fieldkit-pbr-v2"
GRID_SIZE = 4
MASTER_SIZE = 2048
UV_INSET = 0.035

SOURCE_FILES = {
    "composite": "lunar-composite-source.png",
    "graphite": "graphite-alloy-source.png",
    "regolith": "lunar-regolith-source.png",
    "solar": "photovoltaic-source.png",
}

# Order is the canonical UV order used by scripts/moon-settlement-gate1-blender.py.
# UV row zero is the bottom row; conventional PNG row zero is the top row.
ROLE_SPECS = (
    {"role": "hull", "source": "composite", "tint": (0.72, 0.75, 0.75), "roughness": 0.52, "roughnessVariation": 0.12, "metallic": 0.02, "normalStrength": 0.72, "aoStrength": 0.10, "chromaMix": 0.18, "alpha": 1.0},
    {"role": "graphite", "source": "graphite", "tint": (0.125, 0.157, 0.169), "roughness": 0.36, "roughnessVariation": 0.12, "metallic": 0.84, "normalStrength": 0.62, "aoStrength": 0.08, "chromaMix": 0.35, "alpha": 1.0},
    {"role": "regolith", "source": "regolith", "tint": (0.466, 0.427, 0.392), "roughness": 0.93, "roughnessVariation": 0.045, "metallic": 0.01, "normalStrength": 1.45, "aoStrength": 0.18, "chromaMix": 0.42, "alpha": 1.0},
    {"role": "power", "source": "graphite", "tint": (0.867, 0.667, 0.259), "roughness": 0.42, "roughnessVariation": 0.10, "metallic": 0.04, "normalStrength": 0.58, "aoStrength": 0.07, "chromaMix": 0.12, "alpha": 1.0},
    {"role": "material", "source": "graphite", "tint": (0.710, 0.475, 0.306), "roughness": 0.35, "roughnessVariation": 0.11, "metallic": 0.88, "normalStrength": 0.62, "aoStrength": 0.08, "chromaMix": 0.18, "alpha": 1.0},
    {"role": "life", "source": "composite", "tint": (0.388, 0.682, 0.514), "roughness": 0.55, "roughnessVariation": 0.10, "metallic": 0.01, "normalStrength": 0.54, "aoStrength": 0.08, "chromaMix": 0.12, "alpha": 1.0},
    {"role": "signal", "source": "graphite", "tint": (0.361, 0.639, 0.780), "roughness": 0.38, "roughnessVariation": 0.10, "metallic": 0.08, "normalStrength": 0.50, "aoStrength": 0.07, "chromaMix": 0.12, "alpha": 1.0},
    {"role": "matter", "source": "graphite", "tint": (0.506, 0.455, 0.714), "roughness": 0.32, "roughnessVariation": 0.09, "metallic": 0.12, "normalStrength": 0.44, "aoStrength": 0.06, "chromaMix": 0.12, "alpha": 1.0},
    {"role": "damage", "source": "composite", "tint": (0.788, 0.333, 0.333), "roughness": 0.49, "roughnessVariation": 0.12, "metallic": 0.01, "normalStrength": 0.66, "aoStrength": 0.10, "chromaMix": 0.10, "alpha": 1.0},
    {"role": "solar", "source": "solar", "tint": (0.040, 0.120, 0.220), "roughness": 0.19, "roughnessVariation": 0.055, "metallic": 0.08, "normalStrength": 0.30, "aoStrength": 0.05, "chromaMix": 0.62, "alpha": 1.0},
    {"role": "glass", "source": "composite", "tint": (0.350, 0.720, 0.780), "roughness": 0.13, "roughnessVariation": 0.035, "metallic": 0.0, "normalStrength": 0.10, "aoStrength": 0.02, "chromaMix": 0.08, "alpha": 0.36},
    {"role": "soil", "source": "regolith", "tint": (0.300, 0.160, 0.070), "roughness": 0.96, "roughnessVariation": 0.025, "metallic": 0.0, "normalStrength": 1.65, "aoStrength": 0.20, "chromaMix": 0.25, "alpha": 1.0},
    {"role": "window", "source": "solar", "tint": (0.035, 0.150, 0.200), "roughness": 0.16, "roughnessVariation": 0.045, "metallic": 0.0, "normalStrength": 0.17, "aoStrength": 0.03, "chromaMix": 0.36, "alpha": 1.0},
    {"role": "ceramic", "source": "composite", "tint": (0.800, 0.820, 0.790), "roughness": 0.65, "roughnessVariation": 0.09, "metallic": 0.0, "normalStrength": 0.48, "aoStrength": 0.09, "chromaMix": 0.20, "alpha": 1.0},
    {"role": "warm", "source": "composite", "tint": (0.950, 0.500, 0.120), "roughness": 0.31, "roughnessVariation": 0.07, "metallic": 0.0, "normalStrength": 0.28, "aoStrength": 0.05, "chromaMix": 0.08, "alpha": 1.0},
    {"role": "trim", "source": "graphite", "tint": (0.220, 0.280, 0.280), "roughness": 0.35, "roughnessVariation": 0.10, "metallic": 0.82, "normalStrength": 0.56, "aoStrength": 0.07, "chromaMix": 0.30, "alpha": 1.0},
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True)
    return parser.parse_args()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def relative(path: Path, workspace: Path) -> str:
    return path.relative_to(workspace).as_posix()


def ensure_inside(path: Path, workspace: Path) -> Path:
    resolved = path.resolve()
    if resolved != workspace and workspace not in resolved.parents:
        raise RuntimeError(f"Moon texture output escaped the workspace: {resolved}")
    return resolved


def luminance(rgb: np.ndarray) -> np.ndarray:
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def blur_float(channel: np.ndarray, radius: float) -> np.ndarray:
    image = Image.fromarray(np.uint8(np.clip(channel, 0.0, 1.0) * 255.0), mode="L")
    blurred = image.filter(ImageFilter.GaussianBlur(radius=max(0.1, radius)))
    return np.asarray(blurred, dtype=np.float32) / 255.0


def deterministic_crop(image: Image.Image, role: str, index: int, tile_size: int) -> np.ndarray:
    image = ImageOps.exif_transpose(image).convert("RGB")
    side = min(image.size)
    crop_side = max(tile_size, int(side * 0.82))
    digest = hashlib.sha256(f"{CONTRACT_NAME}:{role}:{index}".encode("utf-8")).digest()
    max_x = max(0, image.width - crop_side)
    max_y = max(0, image.height - crop_side)
    x = int.from_bytes(digest[0:2], "big") % (max_x + 1)
    y = int.from_bytes(digest[2:4], "big") % (max_y + 1)
    patch = image.crop((x, y, x + crop_side, y + crop_side))
    rotations = (0, 90, 180, 270)
    patch = patch.rotate(rotations[digest[4] % 4], expand=False)
    if digest[5] & 1:
        patch = ImageOps.mirror(patch)
    patch = patch.resize((tile_size, tile_size), Image.Resampling.LANCZOS)
    return np.asarray(patch, dtype=np.float32) / 255.0


def normalize_baked_lighting(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Remove only broad illumination while keeping authored seams and wear."""
    lum = luminance(rgb)
    broad = blur_float(lum, max(8.0, rgb.shape[0] / 7.5))
    target = float(np.median(broad))
    correction = np.clip(target / np.maximum(broad, 0.045), 0.82, 1.18)
    corrected = np.clip(rgb * correction[..., None], 0.0, 1.0)
    return corrected, luminance(corrected)


def tint_surface(rgb: np.ndarray, lum: np.ndarray, spec: dict) -> np.ndarray:
    target = np.asarray(spec["tint"], dtype=np.float32)
    mean_lum = max(float(np.mean(lum)), 0.04)
    detail = np.clip(lum / mean_lum, 0.58, 1.42)
    tinted = target[None, None, :] * detail[..., None]
    source_mean = np.maximum(np.mean(rgb, axis=(0, 1)), 0.04)
    balanced_source = np.clip(rgb * (target / source_mean)[None, None, :], 0.0, 1.0)
    mixed = tinted * (1.0 - spec["chromaMix"]) + balanced_source * spec["chromaMix"]
    # Keep generated detail believable without allowing crushed shadows or HDR highlights.
    return np.clip(mixed, 0.018, 0.96)


def derive_height(lum: np.ndarray) -> np.ndarray:
    micro = lum - blur_float(lum, max(1.2, lum.shape[0] / 115.0))
    medium = lum - blur_float(lum, max(3.0, lum.shape[0] / 28.0))
    height = micro * 0.72 + medium * 0.28
    scale = float(np.percentile(np.abs(height), 98.5))
    if scale < 1e-5:
        return np.zeros_like(height, dtype=np.float32)
    return np.tanh(height / scale).astype(np.float32)


def derive_normal(height: np.ndarray, strength: float) -> np.ndarray:
    padded = np.pad(height, 1, mode="edge")
    dx = (padded[1:-1, 2:] - padded[1:-1, :-2]) * 0.5
    dy_image = (padded[2:, 1:-1] - padded[:-2, 1:-1]) * 0.5
    slope = float(strength) * 2.65
    # Image Y grows down. Positive tangent-space V grows up, so the resulting
    # OpenGL (+Y) normal uses +dHeight/dImageY here.
    normal = np.stack((-dx * slope, dy_image * slope, np.ones_like(height)), axis=-1)
    normal /= np.maximum(np.linalg.norm(normal, axis=-1, keepdims=True), 1e-6)
    return np.clip(normal * 0.5 + 0.5, 0.0, 1.0)


def derive_orm(height: np.ndarray, lum: np.ndarray, spec: dict) -> np.ndarray:
    cavities = np.clip(-height, 0.0, 1.0)
    ao = np.clip(1.0 - cavities * spec["aoStrength"], 0.68, 1.0)
    detail = np.clip((lum - float(np.mean(lum))) / max(float(np.std(lum)), 0.025), -2.0, 2.0) / 2.0
    roughness = np.clip(
        spec["roughness"] + detail * spec["roughnessVariation"],
        max(0.04, spec["roughness"] - spec["roughnessVariation"]),
        min(0.98, spec["roughness"] + spec["roughnessVariation"]),
    )
    metallic_variation = 0.025 if spec["metallic"] >= 0.5 else 0.008
    metallic = np.clip(spec["metallic"] - cavities * metallic_variation, 0.0, 1.0)
    return np.stack((ao, roughness, metallic), axis=-1)


def add_gutter(tile: np.ndarray) -> np.ndarray:
    """Dilate interior texels into the atlas margin used by the current UVs."""
    gutter = max(2, int(math.ceil(tile.shape[0] * UV_INSET)))
    output = tile.copy()
    output[:gutter, ...] = output[gutter : gutter + 1, ...]
    output[-gutter:, ...] = output[-gutter - 1 : -gutter, ...]
    output[:, :gutter, ...] = output[:, gutter : gutter + 1, ...]
    output[:, -gutter:, ...] = output[:, -gutter - 1 : -gutter, ...]
    return output


def build_master_atlases(sources: dict[str, Image.Image]) -> dict[str, Image.Image]:
    tile_size = MASTER_SIZE // GRID_SIZE
    base = np.zeros((MASTER_SIZE, MASTER_SIZE, 4), dtype=np.float32)
    orm = np.zeros((MASTER_SIZE, MASTER_SIZE, 3), dtype=np.float32)
    normal = np.zeros((MASTER_SIZE, MASTER_SIZE, 3), dtype=np.float32)

    for index, spec in enumerate(ROLE_SPECS):
        rgb = deterministic_crop(sources[spec["source"]], spec["role"], index, tile_size)
        corrected, lum = normalize_baked_lighting(rgb)
        base_rgb = tint_surface(corrected, lum, spec)
        height = derive_height(lum)
        normal_rgb = derive_normal(height, spec["normalStrength"])
        orm_rgb = derive_orm(height, lum, spec)

        alpha = np.full((tile_size, tile_size, 1), spec["alpha"], dtype=np.float32)
        base_tile = add_gutter(np.concatenate((base_rgb, alpha), axis=-1))
        orm_tile = add_gutter(orm_rgb)
        normal_tile = add_gutter(normal_rgb)

        uv_col = index % GRID_SIZE
        uv_row = index // GRID_SIZE
        image_row = GRID_SIZE - 1 - uv_row
        x0 = uv_col * tile_size
        y0 = image_row * tile_size
        base[y0 : y0 + tile_size, x0 : x0 + tile_size] = base_tile
        orm[y0 : y0 + tile_size, x0 : x0 + tile_size] = orm_tile
        normal[y0 : y0 + tile_size, x0 : x0 + tile_size] = normal_tile

    return {
        "basecolor": Image.fromarray(np.uint8(np.round(np.clip(base, 0.0, 1.0) * 255.0)), mode="RGBA"),
        "orm": Image.fromarray(np.uint8(np.round(np.clip(orm, 0.0, 1.0) * 255.0)), mode="RGB"),
        "normal": Image.fromarray(np.uint8(np.round(np.clip(normal, 0.0, 1.0) * 255.0)), mode="RGB"),
    }


def resize_normal(image: Image.Image, size: int) -> Image.Image:
    resized = image.resize((size, size), Image.Resampling.LANCZOS)
    encoded = np.asarray(resized, dtype=np.float32) / 255.0
    vector = encoded * 2.0 - 1.0
    vector /= np.maximum(np.linalg.norm(vector, axis=-1, keepdims=True), 1e-6)
    output = np.uint8(np.round(np.clip(vector * 0.5 + 0.5, 0.0, 1.0) * 255.0))
    return Image.fromarray(output, mode="RGB")


def resize_atlas(channel: str, image: Image.Image, size: int) -> Image.Image:
    if channel == "normal":
        return resize_normal(image, size)
    mode = "RGBA" if channel == "basecolor" else "RGB"
    resized = image.resize((size, size), Image.Resampling.LANCZOS).convert(mode)
    if channel == "orm":
        values = np.asarray(resized, dtype=np.uint8).copy()
        # Lanczos can overshoot by a few code values at atlas boundaries. Keep
        # the exported physical channels inside their authored envelopes.
        values[..., 0] = np.clip(values[..., 0], 174, 255)
        values[..., 1] = np.clip(values[..., 1], 10, 250)
        return Image.fromarray(values, mode="RGB")
    return resized


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", compress_level=9, optimize=False)


def write_contract(
    workspace: Path,
    source_paths: dict[str, Path],
    output_records: list[dict],
    authoring_contract: Path,
    runtime_contract: Path,
) -> dict:
    roles = []
    for index, spec in enumerate(ROLE_SPECS):
        uv_row = index // GRID_SIZE
        roles.append(
            {
                "role": spec["role"],
                "index": index,
                "uvColumn": index % GRID_SIZE,
                "uvRowBottom": uv_row,
                "imageRowTop": GRID_SIZE - 1 - uv_row,
                "source": spec["source"],
                "tintSrgb": list(spec["tint"]),
                "roughness": spec["roughness"],
                "roughnessVariation": spec["roughnessVariation"],
                "metallic": spec["metallic"],
                "normalStrength": spec["normalStrength"],
                "alpha": spec["alpha"],
            }
        )

    contract = {
        "version": 2,
        "contract": CONTRACT_NAME,
        "grid": {"columns": GRID_SIZE, "rows": GRID_SIZE, "uvOrigin": "bottom-left", "imageOrigin": "top-left", "tileInset": UV_INSET},
        "channels": {
            "basecolor": {"colorSpace": "sRGB", "layout": "RGBA", "alphaUse": "glass coverage"},
            "orm": {"colorSpace": "Non-Color", "layout": {"r": "ambientOcclusion", "g": "roughness", "b": "metallic"}},
            "normal": {"colorSpace": "Non-Color", "space": "tangent", "convention": "OpenGL +Y", "layout": "RGB"},
        },
        "sources": {
            key: {"path": relative(path, workspace), "sha256": sha256(path)}
            for key, path in source_paths.items()
        },
        "tiers": {
            "master": {"pixels": MASTER_SIZE, "purpose": "packed editable Blender source"},
            "shared-standard": {"pixels": 1024, "purpose": "one renderer texture set shared by all standard models"},
            "shared-low": {"pixels": 512, "purpose": "one renderer texture set shared by all low models"},
            "embedded-standard": {"pixels": 512, "purpose": "portable per-GLB fallback"},
            "embedded-low": {"pixels": 256, "purpose": "portable per-GLB fallback"},
        },
        "roles": roles,
        "outputs": output_records,
    }
    encoded = json.dumps(contract, indent=2, ensure_ascii=True) + "\n"
    authoring_contract.write_text(encoded, encoding="utf-8")
    runtime_contract.write_text(encoded, encoding="utf-8")
    return contract


def main() -> None:
    args = parse_args()
    workspace = Path(args.workspace).resolve()
    source_root = ensure_inside(
        workspace / "production" / "moon-settlement" / "gate-1" / "source" / "textures" / "professional-v2",
        workspace,
    )
    pbr_root = ensure_inside(source_root.parent / "pbr", workspace)
    runtime_root = ensure_inside(workspace / "public" / "art" / "moon-settlement" / "materials", workspace)
    pbr_root.mkdir(parents=True, exist_ok=True)
    runtime_root.mkdir(parents=True, exist_ok=True)

    source_paths = {key: source_root / filename for key, filename in SOURCE_FILES.items()}
    missing = [str(path) for path in source_paths.values() if not path.is_file()]
    if missing:
        raise FileNotFoundError(f"Missing professional Moon material source(s): {', '.join(missing)}")
    sources = {key: Image.open(path).copy() for key, path in source_paths.items()}
    masters = build_master_atlases(sources)

    output_records: list[dict] = []

    def emit(directory: Path, tier: str, size: int, suffix: str) -> None:
        for channel, master in masters.items():
            path = directory / f"fieldkit-{channel}-{suffix}.png"
            save_png(resize_atlas(channel, master, size), path)
            output_records.append(
                {"tier": tier, "channel": channel, "pixels": size, "path": relative(path, workspace), "bytes": path.stat().st_size, "sha256": sha256(path)}
            )

    emit(pbr_root, "master", MASTER_SIZE, "master")
    emit(pbr_root, "embedded-standard", 512, "standard")
    emit(pbr_root, "embedded-low", 256, "low")
    emit(runtime_root, "shared-standard", 1024, "standard")
    emit(runtime_root, "shared-low", 512, "low")

    authoring_contract = pbr_root / "fieldkit-role-contract.json"
    runtime_contract = runtime_root / "fieldkit-role-contract.json"
    contract = write_contract(workspace, source_paths, output_records, authoring_contract, runtime_contract)
    total_bytes = sum(record["bytes"] for record in output_records)
    print(f"MOON_SETTLEMENT_PBR_OK {len(contract['roles'])} roles, {len(output_records)} atlases, {total_bytes} bytes")
    print(f"MOON_SETTLEMENT_PBR_AUTHORING {pbr_root}")
    print(f"MOON_SETTLEMENT_PBR_RUNTIME {runtime_root}")


if __name__ == "__main__":
    main()
