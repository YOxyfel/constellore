#!/usr/bin/env python3
"""Build deterministic, voice-free Voyage Projection review master candidates.

These mixes are project-authored review artifacts assembled only from the
sample-free procedural score and SFX guide stems. They are not final masters:
navigation voice is absent, human approval is unset, and no runtime release
manifest is touched by this builder.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import stat
import sys
import wave
from pathlib import Path

import numpy as np


SOURCE_ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = Path("scripts/voyage-projection-cinematic.v1.json")
GENERATOR_PATH = Path("scripts/build-voyage-projection-audio-master.py")
GUIDE_RECORD_PATH = Path(
    "production/voyage-projection/scaffold/provenance/audio-guide-record.json"
)
REVIEW_RECORD_PATH = Path(
    "production/voyage-projection/scaffold/provenance/audio-review-master-record.json"
)
REVIEW_DIRECTORY = Path("output/voyage-projection/audio/review")

SAMPLE_RATE = 48_000
CHANNELS = 2
BITS_PER_SAMPLE = 24
DURATION_SECONDS = 57.0
FRAME_COUNT = int(SAMPLE_RATE * DURATION_SECONDS)
MAX_PCM24 = (1 << 23) - 1
RANDOM_SEED = 271_828
TARGET_LOUDNESS_LUFS = -18.0
TRUE_PEAK_CEILING_DBTP = -2.0
SUPPORTED_PYTHON_VERSION = "3.14.0"
SUPPORTED_PYTHON_IMPLEMENTATION = "CPython"
SUPPORTED_NUMPY_VERSION = "2.5.0"
BIT_GENERATOR = "PCG64"
FILE_ATTRIBUTE_REPARSE_POINT = 0x0400

KNOWN_REVIEW_SHA256 = {
    "completion-review-master": "225e95e2c6102bc5601044cb15e0fee2f22b607c02d9e31164c7095625821d5e",
    "promise-review-master": "f8897861fdc09548a5e31c5d795efb2062f9ecb23c204f0772e2c6b4e80feb7b",
}

# ITU-R BS.1770 K-weighting coefficients at 48 kHz. The review analysis uses
# the standard gated block-energy calculation. Final release still requires a
# calibrated production meter and human sign-off.
K_WEIGHTING_FILTERS = (
    (
        (1.53512485958697, -2.69169618940638, 1.19839281085285),
        (1.0, -1.69065929318241, 0.73248077421585),
    ),
    (
        (1.0, -2.0, 1.0),
        (1.0, -1.99004745483398, 0.99007225036621),
    ),
)

NARRATION_WINDOWS = {
    "promise": ((1.0, 6.2), (8.4, 14.2), (39.4, 46.8), (54.0, 56.4)),
    "completion": ((1.0, 6.2), (8.4, 14.2), (39.4, 46.8)),
}

CANDIDATES = (
    {
        "id": "promise-review-master",
        "variant": "promise",
        "path": REVIEW_DIRECTORY / "voyage-projection-promise-review-master.wav",
        "scoreId": "score-unresolved",
        "sfxId": "sfx-unresolved",
    },
    {
        "id": "completion-review-master",
        "variant": "completion",
        "path": REVIEW_DIRECTORY / "voyage-projection-completion-review-master.wav",
        "scoreId": "score-completion",
        "sfxId": "sfx-completion",
    },
)


def has_reparse_point(path: Path) -> bool:
    details = os.lstat(path)
    return stat.S_ISLNK(details.st_mode) or bool(
        getattr(details, "st_file_attributes", 0) & FILE_ATTRIBUTE_REPARSE_POINT
    )


def contained(real_root: Path, candidate: Path) -> bool:
    root_text = os.path.normcase(str(real_root))
    candidate_text = os.path.normcase(str(candidate))
    try:
        return os.path.commonpath((root_text, candidate_text)) == root_text
    except ValueError:
        return False


def prepare_safe_root(root: Path, label: str) -> tuple[Path, Path]:
    lexical = Path(os.path.abspath(root))
    if not lexical.is_dir():
        raise ValueError(f"{label} must be an existing directory: {lexical}")
    current = Path(lexical.anchor)
    for component in lexical.parts[1:]:
        current /= component
        if has_reparse_point(current):
            raise ValueError(f"{label} contains a symlink, junction, or reparse point: {current}")
    real = lexical.resolve(strict=True)
    if os.path.normcase(str(real)) != os.path.normcase(str(lexical)):
        raise ValueError(f"{label} resolves through an untrusted filesystem indirection.")
    return lexical, real


def safe_project_path(
    root: tuple[Path, Path],
    relative_path: Path,
    *,
    must_exist: bool,
) -> Path:
    lexical_root, real_root = root
    relative_path = Path(relative_path)
    if relative_path.is_absolute() or ".." in relative_path.parts:
        raise ValueError(f"Project path must be a contained relative path: {relative_path}")
    target = lexical_root / relative_path
    current = lexical_root
    nearest = lexical_root
    missing = False
    for component in relative_path.parts:
        current /= component
        if missing or not os.path.lexists(current):
            missing = True
            continue
        if has_reparse_point(current):
            raise ValueError(f"Project path contains a symlink, junction, or reparse point: {current}")
        nearest = current
        resolved_component = current.resolve(strict=True)
        if not contained(real_root, resolved_component):
            raise ValueError(f"Project path escapes the real project root: {current}")
    nearest_real = nearest.resolve(strict=True)
    if not contained(real_root, nearest_real):
        raise ValueError(f"Nearest existing parent escapes the real project root: {nearest}")
    if must_exist and missing:
        raise FileNotFoundError(f"Required project path does not exist: {target}")
    return target


def validate_supported_toolchain() -> dict:
    python_version = ".".join(str(value) for value in sys.version_info[:3])
    implementation = sys.implementation.name
    implementation_label = "CPython" if implementation == "cpython" else implementation
    if python_version != SUPPORTED_PYTHON_VERSION:
        raise RuntimeError(
            f"Unsupported Python {python_version}; deterministic review hashes require {SUPPORTED_PYTHON_VERSION}."
        )
    if implementation_label != SUPPORTED_PYTHON_IMPLEMENTATION:
        raise RuntimeError(
            f"Unsupported Python implementation {implementation_label}; {SUPPORTED_PYTHON_IMPLEMENTATION} is required."
        )
    if np.__version__ != SUPPORTED_NUMPY_VERSION:
        raise RuntimeError(
            f"Unsupported NumPy {np.__version__}; deterministic review hashes require {SUPPORTED_NUMPY_VERSION}."
        )
    return {
        "pythonVersion": python_version,
        "pythonImplementation": implementation_label,
        "numpyVersion": np.__version__,
        "bitGenerator": BIT_GENERATOR,
        "knownOutputSha256Locked": True,
        "unsupportedEnvironmentPolicy": "reject-before-read-or-write",
    }


def sha256_bytes(contents: bytes) -> str:
    return hashlib.sha256(contents).hexdigest()


def sha256_file(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def canonical_contract_digest(contract: dict) -> str:
    text = json.dumps(
        contract,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ) + "\n"
    return sha256_bytes(text.encode("utf-8"))


def db_to_gain(decibels: float) -> float:
    return 10.0 ** (float(decibels) / 20.0)


def gain_to_db(gain: float) -> float:
    return 20.0 * math.log10(max(float(gain), 1e-12))


def read_pcm24_wave(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as wav:
        if (
            wav.getnchannels() != CHANNELS
            or wav.getsampwidth() != BITS_PER_SAMPLE // 8
            or wav.getframerate() != SAMPLE_RATE
            or wav.getnframes() != FRAME_COUNT
            or wav.getcomptype() != "NONE"
        ):
            raise ValueError(f"{path} is not the locked 57-second stereo PCM24/48k guide format.")
        payload = wav.readframes(FRAME_COUNT)
    octets = np.frombuffer(payload, dtype=np.uint8).reshape(-1, 3)
    values = (
        octets[:, 0].astype(np.int32)
        | (octets[:, 1].astype(np.int32) << 8)
        | (octets[:, 2].astype(np.int32) << 16)
    )
    values = np.where(values & 0x800000, values - 0x1000000, values)
    return (values.reshape(FRAME_COUNT, CHANNELS).astype(np.float64) / MAX_PCM24)


def pcm24_bytes(samples: np.ndarray) -> bytes:
    flattened = samples.reshape(-1).astype(np.int32)
    unsigned = flattened.astype(np.int64) & 0xFFFFFF
    packed = np.empty((flattened.size, 3), dtype=np.uint8)
    packed[:, 0] = unsigned & 0xFF
    packed[:, 1] = (unsigned >> 8) & 0xFF
    packed[:, 2] = (unsigned >> 16) & 0xFF
    return packed.tobytes()


def quantize_pcm24(audio: np.ndarray, seed: int) -> np.ndarray:
    rng = np.random.Generator(np.random.PCG64(seed))
    # Deterministic triangular dither at one 24-bit LSB prevents correlated
    # truncation while remaining reproducible and independently verifiable.
    dither = (rng.random(audio.shape) - rng.random(audio.shape)) / MAX_PCM24
    return np.rint(np.clip(audio + dither, -1.0, 1.0) * MAX_PCM24).astype(np.int32)


def sample_metrics(samples: np.ndarray) -> tuple[float, float]:
    normalized = samples.astype(np.float64) / MAX_PCM24
    peak = float(np.max(np.abs(normalized)))
    rms = float(np.sqrt(np.mean(normalized * normalized)))
    return gain_to_db(peak), gain_to_db(rms)


def biquad(samples: np.ndarray, b: tuple[float, ...], a: tuple[float, ...]) -> np.ndarray:
    output = np.empty(samples.size, dtype=np.float64)
    x1 = x2 = y1 = y2 = 0.0
    for index in range(samples.size):
        x0 = float(samples[index])
        y0 = b[0] * x0 + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2
        output[index] = y0
        x2, x1 = x1, x0
        y2, y1 = y1, y0
    return output


def k_weighted_energy(audio: np.ndarray) -> np.ndarray:
    energy = np.zeros(audio.shape[0], dtype=np.float64)
    for channel in range(CHANNELS):
        filtered = audio[:, channel]
        for b, a in K_WEIGHTING_FILTERS:
            filtered = biquad(filtered, b, a)
        energy += filtered * filtered
    return energy


def block_means(energy: np.ndarray, window_seconds: float, step_seconds: float) -> np.ndarray:
    window = round(window_seconds * SAMPLE_RATE)
    step = round(step_seconds * SAMPLE_RATE)
    if energy.size < window:
        return np.array([], dtype=np.float64)
    cumulative = np.concatenate((np.array([0.0]), np.cumsum(energy, dtype=np.float64)))
    starts = np.arange(0, energy.size - window + 1, step, dtype=np.int64)
    return (cumulative[starts + window] - cumulative[starts]) / window


def loudness_from_energy(energy: np.ndarray) -> float:
    return -0.691 + 10.0 * math.log10(max(float(energy), 1e-20))


def loudness_metrics(audio: np.ndarray) -> dict:
    energy = k_weighted_energy(audio)
    momentary_energy = block_means(energy, 0.4, 0.1)
    momentary_loudness = np.array(
        [loudness_from_energy(value) for value in momentary_energy],
        dtype=np.float64,
    )
    absolute = momentary_energy[momentary_loudness >= -70.0]
    if not absolute.size:
        integrated = -120.0
    else:
        ungated = loudness_from_energy(float(np.mean(absolute)))
        relative_threshold = ungated - 10.0
        gated = momentary_energy[
            (momentary_loudness >= -70.0) & (momentary_loudness >= relative_threshold)
        ]
        integrated = loudness_from_energy(float(np.mean(gated))) if gated.size else -120.0
    short_term_energy = block_means(energy, 3.0, 1.0)
    short_term_loudness = np.array(
        [loudness_from_energy(value) for value in short_term_energy],
        dtype=np.float64,
    )
    lra_gate = short_term_loudness[
        (short_term_loudness >= -70.0) & (short_term_loudness >= integrated - 20.0)
    ]
    if lra_gate.size:
        low, high = np.percentile(lra_gate, (10.0, 95.0))
        loudness_range = float(high - low)
    else:
        loudness_range = 0.0
    return {
        "integratedLoudnessLufs": integrated,
        "maximumMomentaryLufs": (
            float(np.max(momentary_loudness)) if momentary_loudness.size else -120.0
        ),
        "maximumShortTermLufs": (
            float(np.max(short_term_loudness))
            if short_term_loudness.size
            else -120.0
        ),
        "loudnessRangeLu": loudness_range,
    }


def cubic_value(p0: np.ndarray, p1: np.ndarray, p2: np.ndarray, p3: np.ndarray, t: float) -> np.ndarray:
    return 0.5 * (
        (2.0 * p1)
        + (-p0 + p2) * t
        + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * (t * t)
        + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * (t * t * t)
    )


def true_peak_4x(audio: np.ndarray) -> float:
    peak = float(np.max(np.abs(audio)))
    chunk_size = 262_144
    for channel in range(CHANNELS):
        source = audio[:, channel]
        for start in range(0, source.size - 3, chunk_size):
            end = min(source.size - 3, start + chunk_size)
            p0 = source[start:end]
            p1 = source[start + 1 : end + 1]
            p2 = source[start + 2 : end + 2]
            p3 = source[start + 3 : end + 3]
            for phase in (0.25, 0.5, 0.75):
                peak = max(peak, float(np.max(np.abs(cubic_value(p0, p1, p2, p3, phase)))))
    return gain_to_db(peak)


def duck_envelope(windows: tuple[tuple[float, float], ...], depth_db: float) -> np.ndarray:
    result = np.ones(FRAME_COUNT, dtype=np.float64)
    duck_gain = db_to_gain(depth_db)
    ramp = round(0.28 * SAMPLE_RATE)
    for start_seconds, end_seconds in windows:
        start = round(start_seconds * SAMPLE_RATE)
        end = round(end_seconds * SAMPLE_RATE)
        result[start:end] = np.minimum(result[start:end], duck_gain)
        before = max(0, start - ramp)
        if before < start:
            phase = np.linspace(0.0, 1.0, start - before, endpoint=False)
            curve = 1.0 + (duck_gain - 1.0) * (0.5 - 0.5 * np.cos(math.pi * phase))
            result[before:start] = np.minimum(result[before:start], curve)
        after = min(FRAME_COUNT, end + ramp)
        if end < after:
            phase = np.linspace(0.0, 1.0, after - end, endpoint=False)
            curve = duck_gain + (1.0 - duck_gain) * (0.5 - 0.5 * np.cos(math.pi * phase))
            result[end:after] = np.minimum(result[end:after], curve)
    return result


def assemble_mix(score: np.ndarray, sfx: np.ndarray, variant: str) -> tuple[np.ndarray, dict]:
    windows = NARRATION_WINDOWS[variant]
    score_gain_db = -0.5
    sfx_gain_db = -1.5
    score_duck_db = -2.2
    sfx_duck_db = -1.2
    score_envelope = duck_envelope(windows, score_duck_db)
    sfx_envelope = duck_envelope(windows, sfx_duck_db)
    mix = (
        score * (db_to_gain(score_gain_db) * score_envelope[:, None])
        + sfx * (db_to_gain(sfx_gain_db) * sfx_envelope[:, None])
    )
    # Keep the cinematic image broad without allowing exaggerated side energy.
    middle = 0.5 * (mix[:, 0] + mix[:, 1])
    side = 0.5 * (mix[:, 0] - mix[:, 1]) * 0.92
    mix[:, 0] = middle + side
    mix[:, 1] = middle - side
    # Very light deterministic saturation provides a reviewable glue stage;
    # it is intentionally not a substitute for a human mix decision.
    drive = 1.035
    mix = np.tanh(mix * drive) / math.tanh(drive)
    fade_frames = round(0.08 * SAMPLE_RATE)
    fade = np.sin(np.linspace(0.0, math.pi / 2.0, fade_frames)) ** 2
    mix[:fade_frames] *= fade[:, None]
    mix[-fade_frames:] *= fade[::-1, None]
    return mix, {
        "scoreGainDb": score_gain_db,
        "sfxGainDb": sfx_gain_db,
        "scoreNarrationDuckDb": score_duck_db,
        "sfxNarrationDuckDb": sfx_duck_db,
        "narrationWindows": [list(window) for window in windows],
        "stereoSideScale": 0.92,
        "saturationDrive": drive,
    }


def master_mix(mix: np.ndarray) -> tuple[np.ndarray, dict]:
    loudness = loudness_metrics(mix)
    true_peak = true_peak_4x(mix)
    loudness_gain = TARGET_LOUDNESS_LUFS - loudness["integratedLoudnessLufs"]
    peak_gain = TRUE_PEAK_CEILING_DBTP - true_peak
    applied_gain = min(loudness_gain, peak_gain)
    applied_gain = max(-12.0, min(12.0, applied_gain))
    mastered = mix * db_to_gain(applied_gain)
    return mastered, {
        "normalizationGainDb": applied_gain,
        "samplePeakDbfs": gain_to_db(float(np.max(np.abs(mastered)))),
        "truePeakDbtp": true_peak + applied_gain,
        "integratedLoudnessLufs": loudness["integratedLoudnessLufs"] + applied_gain,
        "maximumMomentaryLufs": loudness["maximumMomentaryLufs"] + applied_gain,
        "maximumShortTermLufs": loudness["maximumShortTermLufs"] + applied_gain,
        "loudnessRangeLu": loudness["loudnessRangeLu"],
    }


def write_review_wave(
    root: tuple[Path, Path],
    relative_path: Path,
    audio: np.ndarray,
    seed: int,
) -> dict:
    path = safe_project_path(root, relative_path, must_exist=False)
    samples = quantize_pcm24(audio, seed)
    payload = pcm24_bytes(samples)
    path.parent.mkdir(parents=True, exist_ok=True)
    path = safe_project_path(root, relative_path, must_exist=False)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(CHANNELS)
        wav.setsampwidth(BITS_PER_SAMPLE // 8)
        wav.setframerate(SAMPLE_RATE)
        wav.setnframes(FRAME_COUNT)
        wav.writeframes(payload)
    sample_peak, rms = sample_metrics(samples)
    return {
        "bytes": path.stat().st_size,
        "dataBytes": len(payload),
        "frames": FRAME_COUNT,
        "durationSeconds": DURATION_SECONDS,
        "samplePeakDbfs": round(sample_peak, 6),
        "rmsDbfs": round(rms, 6),
        "sha256": sha256_file(path),
    }


def validate_guide_record(
    record: dict,
    artifact_root: tuple[Path, Path],
) -> dict[str, dict]:
    if record.get("status") != "non-final-guide" or record.get("releaseEligible") is not False:
        raise ValueError("Guide provenance is not the expected non-final source boundary.")
    if record.get("voice", {}).get("included") is not False:
        raise ValueError("Guide provenance unexpectedly claims included voice.")
    outputs = {entry.get("id"): entry for entry in record.get("outputs", [])}
    required = {candidate[key] for candidate in CANDIDATES for key in ("scoreId", "sfxId")}
    if set(outputs) != required:
        raise ValueError("Guide provenance does not contain exactly the four required source stems.")
    for stem_id, output in outputs.items():
        path = safe_project_path(artifact_root, Path(output["path"]), must_exist=True)
        if not path.is_file() or sha256_file(path) != output.get("sha256"):
            raise ValueError(f"Guide stem {stem_id} is absent or differs from its provenance digest.")
    return outputs


def build_review_masters(source_root: Path, artifact_root: Path) -> dict:
    toolchain = validate_supported_toolchain()
    source_paths = prepare_safe_root(source_root, "source root")
    artifact_paths = prepare_safe_root(artifact_root, "artifact root")
    contract_file = safe_project_path(source_paths, CONTRACT_PATH, must_exist=True)
    generator_file = safe_project_path(source_paths, GENERATOR_PATH, must_exist=True)
    guide_record_file = safe_project_path(artifact_paths, GUIDE_RECORD_PATH, must_exist=True)
    contract = json.loads(contract_file.read_text(encoding="utf-8"))
    if contract.get("durationSeconds") != DURATION_SECONDS:
        raise ValueError("Voyage contract duration must remain 57 seconds.")
    technical = contract.get("technical", {}).get("master", {})
    if technical.get("audioSampleRateHz") != SAMPLE_RATE or technical.get("audioBitDepth") != BITS_PER_SAMPLE:
        raise ValueError("Voyage contract must remain 48 kHz / 24-bit.")
    guide_record = json.loads(guide_record_file.read_text(encoding="utf-8"))
    guide_outputs = validate_guide_record(guide_record, artifact_paths)

    output_records = []
    for index, candidate in enumerate(CANDIDATES):
        score_record = guide_outputs[candidate["scoreId"]]
        sfx_record = guide_outputs[candidate["sfxId"]]
        score_path = safe_project_path(artifact_paths, Path(score_record["path"]), must_exist=True)
        sfx_path = safe_project_path(artifact_paths, Path(sfx_record["path"]), must_exist=True)
        score = read_pcm24_wave(score_path)
        sfx = read_pcm24_wave(sfx_path)
        mix, mix_settings = assemble_mix(score, sfx, candidate["variant"])
        del score, sfx
        mastered, review_metrics = master_mix(mix)
        del mix
        wave_record = write_review_wave(
            artifact_paths,
            candidate["path"],
            mastered,
            RANDOM_SEED + index,
        )
        del mastered
        expected_sha256 = KNOWN_REVIEW_SHA256[candidate["id"]]
        if wave_record["sha256"] != expected_sha256:
            unexpected = safe_project_path(
                artifact_paths,
                candidate["path"],
                must_exist=True,
            )
            unexpected.unlink()
            raise RuntimeError(
                f"{candidate['id']} produced unsupported hash {wave_record['sha256']}; "
                f"expected {expected_sha256}. The untrusted candidate was removed."
            )
        output_records.append({
            "id": candidate["id"],
            "variant": candidate["variant"],
            "path": candidate["path"].as_posix(),
            "status": "voice-free-review-master-candidate",
            "reviewOnly": True,
            "finalMaster": False,
            "releaseEligible": False,
            "voiceIncluded": False,
            "sourceStems": [
                {"id": candidate["scoreId"], "sha256": score_record["sha256"]},
                {"id": candidate["sfxId"], "sha256": sfx_record["sha256"]},
            ],
            "mix": mix_settings,
            "analysis": {
                "targetIntegratedLoudnessLufs": TARGET_LOUDNESS_LUFS,
                "truePeakCeilingDbtp": TRUE_PEAK_CEILING_DBTP,
                "truePeakMethod": "4x four-point cubic intersample estimate for review; calibrated release metering still required",
                **{key: round(value, 6) for key, value in review_metrics.items()},
            },
            "format": {
                "container": "wav",
                "codec": "pcm_s24le",
                "sampleRateHz": SAMPLE_RATE,
                "channels": CHANNELS,
                "bitsPerSample": BITS_PER_SAMPLE,
            },
            **wave_record,
        })

    output_records.sort(key=lambda entry: entry["id"])
    record = {
        "schemaVersion": 1,
        "status": "project-authored-review-master-candidate",
        "releaseEligible": False,
        "finalMaster": False,
        "contract": {
            "path": CONTRACT_PATH.as_posix(),
            "sha256": canonical_contract_digest(contract),
        },
        "generator": {
            "path": GENERATOR_PATH.as_posix(),
            "sha256": sha256_file(generator_file),
            "seed": RANDOM_SEED,
            "deterministic": True,
        },
        "toolchain": toolchain,
        "sourceGuideRecord": {
            "path": GUIDE_RECORD_PATH.as_posix(),
            "sha256": sha256_file(guide_record_file),
        },
        "provenance": {
            "projectAuthored": True,
            "ownershipBasis": "Mixed and mastered deterministically from Constellore project-authored procedural score and SFX source code.",
            "thirdPartySamples": False,
            "generativeModelOutput": False,
            "externalPerformerMaterial": False,
        },
        "voice": {
            "included": False,
            "navigationVoiceComplete": False,
            "status": "absent",
            "performer": None,
            "provider": None,
            "rightsEvidence": None,
        },
        "reviewBoundary": {
            "reviewOnly": True,
            "humanApprovalRequired": True,
            "humanApproval": None,
            "mayPopulateFinalCompositorPaths": False,
            "mayMutateRuntimeMediaApproval": False,
            "statement": "These candidates support creative review only. Add licensed narration, calibrated release metering, and recorded human approval before any final-master promotion.",
        },
        "outputs": output_records,
    }
    record_path = safe_project_path(artifact_paths, REVIEW_RECORD_PATH, must_exist=False)
    record_path.parent.mkdir(parents=True, exist_ok=True)
    record_path = safe_project_path(artifact_paths, REVIEW_RECORD_PATH, must_exist=False)
    record_path.write_text(
        json.dumps(record, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return record


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build deterministic voice-free Voyage review master candidates."
    )
    parser.add_argument("--source-root", type=Path, default=SOURCE_ROOT)
    parser.add_argument("--artifact-root", type=Path, default=SOURCE_ROOT)
    return parser.parse_args()


def main() -> None:
    arguments = parse_args()
    record = build_review_masters(arguments.source_root, arguments.artifact_root)
    print("Voyage Projection project-authored review master candidates built.")
    print("Voice: absent; human approval: absent; release eligible: false.")
    for output in record["outputs"]:
        analysis = output["analysis"]
        print(
            f"{output['id']}: {output['path']} "
            f"({output['bytes']} bytes, {analysis['integratedLoudnessLufs']:.2f} LUFS, "
            f"{analysis['truePeakDbtp']:.2f} dBTP, {output['sha256']})"
        )


if __name__ == "__main__":
    main()
