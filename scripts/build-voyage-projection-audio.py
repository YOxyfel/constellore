#!/usr/bin/env python3
"""Build non-final, sample-free Voyage Projection score and SFX guides.

The generated WAV files are deterministic procedural references. They contain
no recorded voice, third-party samples, model output, performer likeness, or
rights approval. They must not be promoted to a final master merely because
this script and its verifier pass.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import math
import wave
from pathlib import Path
from typing import Iterable

import numpy as np


SOURCE_ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = Path("scripts/voyage-projection-cinematic.v1.json")
GENERATOR_PATH = Path("scripts/build-voyage-projection-audio.py")
OUTPUT_DIRECTORY = Path("output/voyage-projection/audio/stems")
CUE_SHEET_PATH = Path("production/voyage-projection/scaffold/audio-cue-sheet.csv")
PROVENANCE_PATH = Path(
    "production/voyage-projection/scaffold/provenance/audio-guide-record.json"
)

SAMPLE_RATE = 48_000
CHANNELS = 2
BITS_PER_SAMPLE = 24
DURATION_SECONDS = 57.0
FRAME_COUNT = int(SAMPLE_RATE * DURATION_SECONDS)
RANDOM_SEED = 314_159

SCORE_TARGET_PEAK_DBFS = -12.0
SFX_TARGET_PEAK_DBFS = -8.0
MAX_SAMPLE_PEAK_DBFS = -3.0

STEM_DEFINITIONS = (
    {
        "id": "score-unresolved",
        "path": OUTPUT_DIRECTORY / "voyage-projection-score-unresolved-guide.wav",
        "bus": "music",
        "variants": ["promise", "progress"],
        "target_peak_dbfs": SCORE_TARGET_PEAK_DBFS,
    },
    {
        "id": "sfx-unresolved",
        "path": OUTPUT_DIRECTORY / "voyage-projection-sfx-unresolved-guide.wav",
        "bus": "effects",
        "variants": ["promise", "progress"],
        "target_peak_dbfs": SFX_TARGET_PEAK_DBFS,
    },
    {
        "id": "score-completion",
        "path": OUTPUT_DIRECTORY / "voyage-projection-score-completion-guide.wav",
        "bus": "music",
        "variants": ["completion"],
        "target_peak_dbfs": SCORE_TARGET_PEAK_DBFS,
    },
    {
        "id": "sfx-completion",
        "path": OUTPUT_DIRECTORY / "voyage-projection-sfx-completion-guide.wav",
        "bus": "effects",
        "variants": ["completion"],
        "target_peak_dbfs": SFX_TARGET_PEAK_DBFS,
    },
)

CANONICAL_NARRATION = (
    (
        "understanding-makes-reachable",
        1.0,
        6.2,
        "Every world we understand becomes somewhere we can reach.",
        "promise|progress|completion",
    ),
    (
        "discovery-makes-coordinate",
        8.4,
        14.2,
        "Every discovery gives the voyage another coordinate.",
        "promise|progress|completion",
    ),
    (
        "map-has-no-word",
        39.4,
        46.8,
        "Beyond the last light, the map has no word for what comes next.",
        "promise|progress|completion",
    ),
    (
        "make-one",
        54.0,
        56.4,
        "So we will make one.",
        "promise|progress",
    ),
)

# At approximately 110 WPM these windows retain every approved word without
# overlap or clipping inside the locked 24-second reduced-motion presentation.
REDUCED_MOTION_NARRATION = (
    (
        "understanding-makes-reachable",
        0.40,
        5.31,
        "Every world we understand becomes somewhere we can reach.",
        "promise|progress|completion",
    ),
    (
        "discovery-makes-coordinate",
        5.65,
        9.47,
        "Every discovery gives the voyage another coordinate.",
        "promise|progress|completion",
    ),
    (
        "map-has-no-word",
        11.90,
        18.99,
        "Beyond the last light, the map has no word for what comes next.",
        "promise|progress|completion",
    ),
    (
        "make-one",
        20.80,
        23.53,
        "So we will make one.",
        "promise|progress",
    ),
)

SCORE_SECTIONS = (
    ("projection-wake", 0.0, 7.0, "promise|progress|completion", "Earth-scale navigation intelligence wakes."),
    ("solar-route", 7.0, 20.0, "promise|progress|completion", "Known coordinates acquire a restrained harmonic pulse."),
    ("heliopause-thins", 20.0, 27.0, "promise|progress|completion", "Familiar sunlight and upper partials fall away."),
    ("fold-distance", 27.0, 38.0, "promise|progress|completion", "A stable forward harmonic field supports the warp corridor."),
    ("last-light", 38.0, 48.0, "promise|progress|completion", "Low gravity tension leaves narration intelligible."),
    ("data-boundary", 48.0, 53.0, "promise|progress|completion", "The harmonic field contracts toward the singularity."),
    ("earth-return", 53.0, 57.0, "promise|progress", "An unresolved Earth chord restores agency."),
    ("beyond-emergence", 53.0, 57.0, "completion", "An open, still-unresolved color field continues beyond."),
)

SFX_CUES = (
    ("projection-online", 0.00, 0.90, "promise|progress|completion", "Projection wake and low navigation transient."),
    ("engine-ignition", 0.25, 1.60, "promise|progress|completion", "Sample-free ignition bloom."),
    ("earth-liftoff", 2.00, 7.00, "promise|progress|completion", "Procedural rocket thrust and diminishing ground resonance."),
    ("moon-coordinate", 7.00, 7.30, "promise|progress|completion", "First route-coordinate accent."),
    ("mercury-coordinate", 8.20, 8.50, "promise|progress|completion", "Solar coordinate accent."),
    ("venus-coordinate", 9.80, 10.10, "promise|progress|completion", "Solar coordinate accent."),
    ("mars-coordinate", 11.60, 11.90, "promise|progress|completion", "Solar coordinate accent."),
    ("jupiter-coordinate", 13.70, 14.00, "promise|progress|completion", "Solar coordinate accent."),
    ("saturn-coordinate", 15.70, 16.00, "promise|progress|completion", "Solar coordinate accent."),
    ("uranus-coordinate", 17.40, 17.70, "promise|progress|completion", "Solar coordinate accent."),
    ("neptune-coordinate", 19.00, 19.30, "promise|progress|completion", "Last known solar coordinate accent."),
    ("heliopause-shear", 20.00, 27.00, "promise|progress|completion", "Filtered solar wind thins into silence."),
    ("warp-ignition", 27.00, 28.60, "promise|progress|completion", "Route fold ignition without camera-shake language."),
    ("warp-corridor", 27.00, 38.00, "promise|progress|completion", "Stable procedural transit field."),
    ("gravity-arrival", 38.00, 39.40, "promise|progress|completion", "Subharmonic arrival at the black-hole approach."),
    ("accretion-shear", 38.00, 48.00, "promise|progress|completion", "Restrained orbital air and low tidal movement."),
    ("singularity-collapse", 48.00, 53.00, "promise|progress|completion", "The projection contracts at its data boundary."),
    ("return-fold", 53.00, 56.20, "promise|progress", "Reverse fold returns the projection to Earth."),
    ("beyond-release", 53.00, 57.00, "completion", "A quiet spectral release continues beyond the old boundary."),
)


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


def project_path(path: Path, root: Path) -> str:
    return path.resolve().relative_to(root.resolve()).as_posix()


def seconds_to_index(seconds: float) -> int:
    return max(0, min(FRAME_COUNT, round(float(seconds) * SAMPLE_RATE)))


def make_audio_buffer() -> np.ndarray:
    return np.zeros((FRAME_COUNT, CHANNELS), dtype=np.float32)


def envelope(size: int, attack: float, release: float) -> np.ndarray:
    values = np.ones(size, dtype=np.float32)
    attack_samples = min(size, max(1, round(attack * SAMPLE_RATE)))
    release_samples = min(size, max(1, round(release * SAMPLE_RATE)))
    values[:attack_samples] *= np.sin(
        np.linspace(0.0, math.pi / 2.0, attack_samples, dtype=np.float32)
    ) ** 2
    values[-release_samples:] *= np.sin(
        np.linspace(math.pi / 2.0, 0.0, release_samples, dtype=np.float32)
    ) ** 2
    return values


def stereo_gains(pan: float) -> tuple[float, float]:
    normalized = max(-1.0, min(1.0, float(pan)))
    angle = (normalized + 1.0) * math.pi / 4.0
    return math.cos(angle), math.sin(angle)


def add_signal(
    audio: np.ndarray,
    signal: np.ndarray,
    start_seconds: float,
    *,
    pan: float = 0.0,
) -> None:
    start = seconds_to_index(start_seconds)
    end = min(FRAME_COUNT, start + signal.shape[0])
    if end <= start:
        return
    left, right = stereo_gains(pan)
    segment = signal[: end - start]
    audio[start:end, 0] += segment * left
    audio[start:end, 1] += segment * right


def tone(
    seconds: float,
    frequency: float,
    *,
    gain: float,
    harmonics: Iterable[tuple[float, float]] = ((1.0, 1.0),),
    attack: float = 0.02,
    release: float = 0.12,
    phase: float = 0.0,
    drift_hz: float = 0.0,
) -> np.ndarray:
    size = max(1, round(seconds * SAMPLE_RATE))
    time = np.arange(size, dtype=np.float32) / SAMPLE_RATE
    drift = drift_hz * np.sin(2.0 * math.pi * 0.083 * time)
    base_phase = 2.0 * math.pi * frequency * time + drift + phase
    signal = np.zeros(size, dtype=np.float32)
    for multiplier, amount in harmonics:
        signal += float(amount) * np.sin(base_phase * float(multiplier))
    scale = max(1.0, sum(abs(float(amount)) for _, amount in harmonics))
    signal *= float(gain) / scale
    signal *= envelope(size, attack, release)
    return signal.astype(np.float32, copy=False)


def chirp(
    seconds: float,
    start_frequency: float,
    end_frequency: float,
    *,
    gain: float,
    attack: float = 0.01,
    release: float = 0.18,
) -> np.ndarray:
    size = max(1, round(seconds * SAMPLE_RATE))
    time = np.arange(size, dtype=np.float32) / SAMPLE_RATE
    slope = (float(end_frequency) - float(start_frequency)) / max(seconds, 1e-6)
    phase = 2.0 * math.pi * (float(start_frequency) * time + 0.5 * slope * time * time)
    signal = np.sin(phase) + 0.22 * np.sin(2.003 * phase + 0.4)
    signal *= float(gain) / 1.22
    signal *= envelope(size, attack, release)
    return signal.astype(np.float32, copy=False)


def shaped_noise(
    rng: np.random.Generator,
    seconds: float,
    *,
    gain: float,
    smooth_samples: int = 1,
    attack: float = 0.02,
    release: float = 0.2,
) -> np.ndarray:
    size = max(1, round(seconds * SAMPLE_RATE))
    signal = rng.standard_normal(size).astype(np.float32)
    if smooth_samples > 1:
        kernel = np.ones(smooth_samples, dtype=np.float32) / float(smooth_samples)
        signal = np.convolve(signal, kernel, mode="same").astype(np.float32)
    peak = float(np.max(np.abs(signal))) or 1.0
    signal *= float(gain) / peak
    signal *= envelope(size, attack, release)
    return signal.astype(np.float32, copy=False)


def add_pad(
    audio: np.ndarray,
    start: float,
    end: float,
    frequencies: Iterable[float],
    *,
    gain: float,
    pan_width: float = 0.34,
) -> None:
    notes = tuple(float(value) for value in frequencies)
    duration = max(0.05, end - start)
    for index, frequency in enumerate(notes):
        position = 0.0 if len(notes) == 1 else (index / (len(notes) - 1)) * 2.0 - 1.0
        signal = tone(
            duration,
            frequency,
            gain=gain / max(1, len(notes)),
            harmonics=((1.0, 1.0), (2.003, 0.24), (3.997, 0.09), (0.5, 0.07)),
            attack=min(1.8, duration * 0.24),
            release=min(1.8, duration * 0.28),
            phase=index * 0.41,
            drift_hz=0.013 * (index + 1),
        )
        add_signal(audio, signal, start, pan=position * pan_width)


def add_chime(audio: np.ndarray, at: float, frequency: float, *, gain: float, pan: float) -> None:
    duration = 1.15
    size = round(duration * SAMPLE_RATE)
    time = np.arange(size, dtype=np.float32) / SAMPLE_RATE
    signal = (
        np.sin(2.0 * math.pi * frequency * time)
        + 0.36 * np.sin(2.0 * math.pi * frequency * 2.41 * time + 0.3)
        + 0.15 * np.sin(2.0 * math.pi * frequency * 4.13 * time + 1.1)
    )
    signal *= np.exp(-time * 3.45).astype(np.float32)
    signal *= gain / 1.51
    signal *= envelope(size, 0.006, 0.18)
    add_signal(audio, signal.astype(np.float32), at, pan=pan)


def build_common_score() -> np.ndarray:
    audio = make_audio_buffer()
    add_pad(audio, 0.0, 7.0, (73.42, 110.00, 146.83, 220.00), gain=0.23)
    add_pad(audio, 7.0, 20.0, (73.42, 92.50, 110.00, 164.81, 220.00), gain=0.27)
    add_pad(audio, 20.0, 27.0, (61.74, 92.50, 123.47, 164.81), gain=0.19)
    add_pad(audio, 27.0, 38.0, (55.00, 82.41, 123.47, 185.00), gain=0.25)
    add_pad(audio, 38.0, 48.0, (46.25, 69.30, 103.83, 138.59), gain=0.21)
    add_pad(audio, 48.0, 53.0, (41.20, 61.74, 92.50, 123.47), gain=0.18)

    for at, frequency, pan in (
        (3.15, 440.00, -0.22),
        (9.05, 554.37, 0.24),
        (12.55, 659.25, -0.16),
        (16.15, 493.88, 0.18),
        (21.50, 369.99, -0.12),
        (29.20, 415.30, 0.15),
        (34.60, 622.25, -0.18),
        (41.10, 311.13, 0.12),
    ):
        add_chime(audio, at, frequency, gain=0.042, pan=pan)
    return audio


def add_score_tail(audio: np.ndarray, variant: str) -> None:
    if variant == "completion":
        add_pad(audio, 53.0, 57.0, (73.42, 110.00, 164.81, 246.94, 329.63), gain=0.28)
        add_chime(audio, 53.35, 739.99, gain=0.054, pan=-0.18)
        add_chime(audio, 54.45, 987.77, gain=0.042, pan=0.22)
    else:
        add_pad(audio, 53.0, 57.0, (73.42, 110.00, 146.83, 220.00), gain=0.23)
        add_chime(audio, 53.55, 440.00, gain=0.038, pan=0.0)


def build_common_sfx() -> np.ndarray:
    audio = make_audio_buffer()
    rng = np.random.default_rng(RANDOM_SEED)

    add_signal(audio, chirp(0.90, 58.0, 112.0, gain=0.18, release=0.28), 0.0, pan=-0.05)
    add_signal(audio, shaped_noise(rng, 1.35, gain=0.12, smooth_samples=12, release=0.34), 0.25, pan=0.08)
    add_signal(audio, chirp(1.25, 44.0, 84.0, gain=0.22, attack=0.03, release=0.32), 0.25, pan=0.0)

    thrust = tone(
        5.0,
        43.0,
        gain=0.21,
        harmonics=((1.0, 1.0), (2.01, 0.36), (3.04, 0.14)),
        attack=0.35,
        release=0.85,
        drift_hz=0.22,
    )
    thrust_noise = shaped_noise(rng, 5.0, gain=0.10, smooth_samples=20, attack=0.25, release=0.8)
    add_signal(audio, thrust + thrust_noise, 2.0, pan=0.0)

    coordinate_times = (7.0, 8.2, 9.8, 11.6, 13.7, 15.7, 17.4, 19.0)
    coordinate_frequencies = (329.63, 369.99, 415.30, 466.16, 523.25, 587.33, 659.25, 739.99)
    for index, (at, frequency) in enumerate(zip(coordinate_times, coordinate_frequencies)):
        add_signal(
            audio,
            tone(
                0.30,
                frequency,
                gain=0.075,
                harmonics=((1.0, 1.0), (2.73, 0.24)),
                attack=0.004,
                release=0.18,
            ),
            at,
            pan=-0.35 + (index / 7.0) * 0.70,
        )

    solar_wind = shaped_noise(rng, 7.0, gain=0.095, smooth_samples=32, attack=0.6, release=1.2)
    solar_tone = chirp(7.0, 176.0, 72.0, gain=0.055, attack=0.8, release=1.0)
    add_signal(audio, solar_wind + solar_tone, 20.0, pan=0.12)

    add_signal(audio, chirp(1.60, 72.0, 1_460.0, gain=0.23, release=0.35), 27.0, pan=0.0)
    warp_noise = shaped_noise(rng, 11.0, gain=0.12, smooth_samples=10, attack=0.55, release=0.85)
    warp_body = tone(
        11.0,
        58.0,
        gain=0.13,
        harmonics=((1.0, 1.0), (1.5, 0.24), (2.0, 0.17)),
        attack=0.45,
        release=0.9,
        drift_hz=0.7,
    )
    add_signal(audio, warp_noise + warp_body, 27.0, pan=-0.03)

    add_signal(audio, chirp(1.40, 92.0, 28.0, gain=0.27, release=0.5), 38.0, pan=0.0)
    accretion = shaped_noise(rng, 10.0, gain=0.075, smooth_samples=18, attack=0.75, release=1.0)
    tidal = tone(
        10.0,
        34.0,
        gain=0.14,
        harmonics=((1.0, 1.0), (1.997, 0.28)),
        attack=0.8,
        release=1.2,
        drift_hz=0.13,
    )
    add_signal(audio, accretion + tidal, 38.0, pan=0.06)

    collapse = chirp(5.0, 280.0, 24.0, gain=0.25, attack=0.1, release=0.9)
    collapse_noise = shaped_noise(rng, 5.0, gain=0.09, smooth_samples=40, attack=0.1, release=1.0)
    add_signal(audio, collapse + collapse_noise, 48.0, pan=0.0)
    return audio


def add_sfx_tail(audio: np.ndarray, variant: str) -> None:
    rng = np.random.default_rng(RANDOM_SEED + (17 if variant == "completion" else 11))
    if variant == "completion":
        release = chirp(4.0, 96.0, 1_120.0, gain=0.18, attack=0.18, release=0.8)
        shimmer = shaped_noise(rng, 4.0, gain=0.065, smooth_samples=6, attack=0.3, release=0.8)
        add_signal(audio, release + shimmer, 53.0, pan=0.08)
    else:
        fold = chirp(3.2, 760.0, 54.0, gain=0.18, attack=0.08, release=0.7)
        air = shaped_noise(rng, 3.2, gain=0.055, smooth_samples=20, attack=0.15, release=0.7)
        add_signal(audio, fold + air, 53.0, pan=-0.05)
        add_signal(audio, tone(1.1, 73.42, gain=0.09, attack=0.08, release=0.65), 55.6, pan=0.0)


def normalized_for_peak(audio: np.ndarray, target_dbfs: float) -> np.ndarray:
    shaped = np.tanh(audio * 1.08) / math.tanh(1.08)
    peak = float(np.max(np.abs(shaped)))
    if peak <= 0.0:
        raise ValueError("Guide synthesis produced silence.")
    target = 10.0 ** (float(target_dbfs) / 20.0)
    return (shaped * (target / peak)).astype(np.float32)


def quantize_pcm24(audio: np.ndarray) -> np.ndarray:
    maximum = (1 << 23) - 1
    clipped = np.clip(audio, -1.0, 1.0)
    return np.rint(clipped * maximum).astype(np.int32)


def pcm24_bytes(samples: np.ndarray) -> bytes:
    interleaved = samples.reshape(-1)
    unsigned = np.bitwise_and(interleaved.astype(np.int64), 0xFFFFFF)
    packed = np.empty((unsigned.size, 3), dtype=np.uint8)
    packed[:, 0] = unsigned & 0xFF
    packed[:, 1] = (unsigned >> 8) & 0xFF
    packed[:, 2] = (unsigned >> 16) & 0xFF
    return packed.tobytes()


def metrics(samples: np.ndarray) -> tuple[float, float]:
    maximum = float((1 << 23) - 1)
    normalized = samples.astype(np.float64) / maximum
    peak = float(np.max(np.abs(normalized)))
    rms = float(np.sqrt(np.mean(normalized * normalized)))
    peak_dbfs = 20.0 * math.log10(max(peak, 1e-12))
    rms_dbfs = 20.0 * math.log10(max(rms, 1e-12))
    return round(peak_dbfs, 6), round(rms_dbfs, 6)


def write_pcm24_wave(path: Path, audio: np.ndarray) -> dict:
    if audio.shape != (FRAME_COUNT, CHANNELS):
        raise ValueError(f"Unexpected guide shape {audio.shape}.")
    samples = quantize_pcm24(audio)
    payload = pcm24_bytes(samples)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(CHANNELS)
        wav.setsampwidth(BITS_PER_SAMPLE // 8)
        wav.setframerate(SAMPLE_RATE)
        wav.setnframes(FRAME_COUNT)
        wav.writeframes(payload)
    peak_dbfs, rms_dbfs = metrics(samples)
    return {
        "bytes": path.stat().st_size,
        "dataBytes": len(payload),
        "frames": FRAME_COUNT,
        "durationSeconds": DURATION_SECONDS,
        "samplePeakDbfs": peak_dbfs,
        "rmsDbfs": rms_dbfs,
        "sha256": sha256_file(path),
    }


def cue_rows() -> list[list[object]]:
    rows: list[list[object]] = [[
        "timeline",
        "type",
        "id",
        "variants",
        "start_seconds",
        "end_seconds",
        "start_frame",
        "end_frame_exclusive",
        "bus",
        "audio_included",
        "release_eligible",
        "description",
    ]]

    def append(
        timeline: str,
        kind: str,
        cue_id: str,
        variants: str,
        start: float,
        end: float,
        bus: str,
        included: bool,
        description: str,
    ) -> None:
        rows.append([
            timeline,
            kind,
            cue_id,
            variants,
            f"{start:.2f}",
            f"{end:.2f}",
            round(start * 24),
            round(end * 24),
            bus,
            str(included).lower(),
            "false",
            description,
        ])

    for cue_id, start, end, variants, description in SCORE_SECTIONS:
        append("canonical-57s", "score", cue_id, variants, start, end, "music", True, description)
    for cue_id, start, end, variants, description in SFX_CUES:
        append("canonical-57s", "sfx", cue_id, variants, start, end, "effects", True, description)
    for cue_id, start, end, text, variants in CANONICAL_NARRATION:
        append("canonical-57s", "narration", cue_id, variants, start, end, "voice", False, text)
    for cue_id, start, end, text, variants in REDUCED_MOTION_NARRATION:
        append("reduced-motion-24s", "narration", cue_id, variants, start, end, "voice", False, text)
    return rows


def cue_sheet_text() -> str:
    output = io.StringIO(newline="")
    writer = csv.writer(output, lineterminator="\n")
    writer.writerows(cue_rows())
    return output.getvalue()


def write_text(path: Path, contents: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(contents, encoding="utf-8", newline="\n")


def build_guides(source_root: Path, artifact_root: Path) -> dict:
    source_root = source_root.resolve()
    artifact_root = artifact_root.resolve()
    contract_file = source_root / CONTRACT_PATH
    generator_file = source_root / GENERATOR_PATH
    contract = json.loads(contract_file.read_text(encoding="utf-8"))
    if contract.get("durationSeconds") != DURATION_SECONDS:
        raise ValueError("Voyage contract duration must remain 57 seconds.")
    technical = contract.get("technical", {}).get("master", {})
    if technical.get("audioSampleRateHz") != SAMPLE_RATE or technical.get("audioBitDepth") != BITS_PER_SAMPLE:
        raise ValueError("Voyage contract must remain 48 kHz / 24-bit before guides are built.")

    cue_sheet = cue_sheet_text()
    cue_path = artifact_root / CUE_SHEET_PATH
    write_text(cue_path, cue_sheet)

    output_records: list[dict] = []
    common_score = build_common_score()
    for variant, stem_id in (("unresolved", "score-unresolved"), ("completion", "score-completion")):
        definition = next(item for item in STEM_DEFINITIONS if item["id"] == stem_id)
        audio = common_score.copy()
        add_score_tail(audio, variant)
        audio = normalized_for_peak(audio, definition["target_peak_dbfs"])
        output_path = artifact_root / definition["path"]
        details = write_pcm24_wave(output_path, audio)
        output_records.append({
            "id": definition["id"],
            "path": definition["path"].as_posix(),
            "bus": definition["bus"],
            "variants": definition["variants"],
            "guideOnly": True,
            "voiceIncluded": False,
            "sampleRateHz": SAMPLE_RATE,
            "channels": CHANNELS,
            "bitsPerSample": BITS_PER_SAMPLE,
            "targetSamplePeakDbfs": definition["target_peak_dbfs"],
            **details,
        })
    del common_score

    common_sfx = build_common_sfx()
    for variant, stem_id in (("unresolved", "sfx-unresolved"), ("completion", "sfx-completion")):
        definition = next(item for item in STEM_DEFINITIONS if item["id"] == stem_id)
        audio = common_sfx.copy()
        add_sfx_tail(audio, variant)
        audio = normalized_for_peak(audio, definition["target_peak_dbfs"])
        output_path = artifact_root / definition["path"]
        details = write_pcm24_wave(output_path, audio)
        output_records.append({
            "id": definition["id"],
            "path": definition["path"].as_posix(),
            "bus": definition["bus"],
            "variants": definition["variants"],
            "guideOnly": True,
            "voiceIncluded": False,
            "sampleRateHz": SAMPLE_RATE,
            "channels": CHANNELS,
            "bitsPerSample": BITS_PER_SAMPLE,
            "targetSamplePeakDbfs": definition["target_peak_dbfs"],
            **details,
        })
    del common_sfx

    output_records.sort(key=lambda item: item["id"])
    record = {
        "schemaVersion": 1,
        "status": "non-final-guide",
        "releaseEligible": False,
        "createsRightsEvidence": False,
        "contract": {
            "path": CONTRACT_PATH.as_posix(),
            "sha256": canonical_contract_digest(contract),
        },
        "generator": {
            "path": GENERATOR_PATH.as_posix(),
            "sha256": sha256_file(generator_file),
            "seed": RANDOM_SEED,
            "method": "deterministic sample-free additive synthesis and filtered procedural noise",
            "thirdPartySamples": False,
            "generativeModelOutput": False,
        },
        "cueSheet": {
            "path": CUE_SHEET_PATH.as_posix(),
            "sha256": sha256_bytes(cue_sheet.encode("utf-8")),
        },
        "format": {
            "container": "wav",
            "codec": "pcm_s24le",
            "sampleRateHz": SAMPLE_RATE,
            "channels": CHANNELS,
            "bitsPerSample": BITS_PER_SAMPLE,
            "durationSeconds": DURATION_SECONDS,
            "maximumGuideSamplePeakDbfs": MAX_SAMPLE_PEAK_DBFS,
        },
        "voice": {
            "included": False,
            "status": "absent",
            "provider": None,
            "performer": None,
            "commercialUseDocumented": False,
            "livingPerformerImitation": None,
            "sourceSha256": None,
            "masteredSha256": None,
        },
        "rights": {
            "commercialUseDocumented": False,
            "humanApproval": None,
            "composerOrLibraryLicense": None,
            "statement": "Guide synthesis is inspectable and sample-free, but this record is not owner approval or a commercial-rights grant.",
        },
        "limitations": [
            "No narration is rendered into these stems.",
            "No final mix, loudness master, true-peak approval, performer release, or synthetic-voice license exists here.",
            "Passing the guide verifier does not satisfy navigation-voice or score-and-sound-design release provenance.",
            "Files under output/voyage-projection/audio are production guides and must not be copied into public release assets.",
        ],
        "outputs": output_records,
    }
    provenance_path = artifact_root / PROVENANCE_PATH
    write_text(
        provenance_path,
        json.dumps(record, ensure_ascii=False, indent=2) + "\n",
    )
    return record


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build non-final deterministic Voyage score and SFX guides."
    )
    parser.add_argument(
        "--source-root",
        type=Path,
        default=SOURCE_ROOT,
        help="Repository root containing the contract and generator source.",
    )
    parser.add_argument(
        "--artifact-root",
        type=Path,
        default=SOURCE_ROOT,
        help="Root receiving canonical output/ and production/ guide paths.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    record = build_guides(args.source_root, args.artifact_root)
    print("Voyage Projection non-final audio guides built.")
    print(f"Status: {record['status']}; release eligible: {str(record['releaseEligible']).lower()}")
    for output in record["outputs"]:
        print(
            f"{output['id']}: {output['path']} "
            f"({output['bytes']} bytes, peak {output['samplePeakDbfs']:.3f} dBFS, {output['sha256']})"
        )


if __name__ == "__main__":
    main()
