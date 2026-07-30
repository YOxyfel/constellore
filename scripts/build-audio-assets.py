#!/usr/bin/env python3
"""Build Constellore's original procedural soundtrack and themed SFX banks.

The checked-in runtime assets are deterministic and use no samples, models, or
third-party musical material. Regeneration requires NumPy and ffmpeg.
"""

from __future__ import annotations

import argparse
import math
import os
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "audio"
MUSIC_RATE = 32_000
SFX_RATE = 32_000
TRACK_SECONDS = 64.0
SFX_SLOT_SECONDS = 1.4
SFX_CUES = (
    "place",
    "combineStart",
    "success",
    "reject",
    "twist",
    "target",
    "sense",
    "mastery",
    "ghostPass",
    "gateClose",
    "gateOpen",
    "runStart",
    "resultReveal",
    "homeReturn",
    "timerWarning",
    "timeout",
    "failure",
    "reward",
    "collectionUnlock",
    "rankPromotion",
    "earth",
    "water",
    "fire",
    "air",
)
RNG = np.random.default_rng(0xC057E110)


def midi(note: float) -> float:
    return 440.0 * (2.0 ** ((note - 69.0) / 12.0))


def envelope(
    size: int,
    sample_rate: int,
    attack: float,
    release: float,
    *,
    decay: float = 0.0,
) -> np.ndarray:
    env = np.ones(size, dtype=np.float32)
    attack_samples = min(size, max(1, round(attack * sample_rate)))
    release_samples = min(size, max(1, round(release * sample_rate)))
    env[:attack_samples] *= np.sin(
        np.linspace(0.0, math.pi / 2.0, attack_samples, dtype=np.float32)
    ) ** 2
    env[-release_samples:] *= np.sin(
        np.linspace(math.pi / 2.0, 0.0, release_samples, dtype=np.float32)
    ) ** 2
    if decay > 0:
        env *= np.exp(-np.arange(size, dtype=np.float32) / (decay * sample_rate))
    return env


def voice(
    name: str,
    frequency: float,
    seconds: float,
    sample_rate: int,
    *,
    phase: float = 0.0,
) -> np.ndarray:
    size = max(1, round(seconds * sample_rate))
    time = np.arange(size, dtype=np.float32) / sample_rate
    angle = 2.0 * math.pi * frequency * time + phase

    if name == "atlas-pad":
        vibrato = 0.006 * np.sin(2.0 * math.pi * 0.09 * time)
        signal = (
            np.sin(angle + vibrato)
            + 0.30 * np.sin(2.0 * angle + 0.31)
            + 0.13 * np.sin(3.0 * angle + 1.1)
            + 0.08 * np.sin(0.5 * angle + 0.6)
        )
        signal *= envelope(size, sample_rate, 0.9, 1.35)
    elif name == "aurora-pad":
        drift = 0.012 * np.sin(2.0 * math.pi * 0.055 * time)
        signal = (
            np.sin(angle + drift)
            + 0.34 * np.sin(1.003 * angle + 0.7)
            + 0.22 * np.sin(2.01 * angle + 1.9)
            + 0.10 * np.sin(3.997 * angle + 0.2)
        )
        signal *= envelope(size, sample_rate, 1.4, 1.55)
    elif name == "foundry-pad":
        signal = sum(
            (0.72 / harmonic)
            * np.sin(harmonic * angle + (0.17 * harmonic))
            for harmonic in range(1, 7)
        )
        signal += 0.23 * np.sin(0.5 * angle)
        signal *= envelope(size, sample_rate, 0.38, 0.75)
    elif name == "lunar-pad":
        drift = 0.004 * np.sin(2.0 * math.pi * 0.07 * time)
        signal = (
            np.sin(angle + drift)
            + 0.28 * np.sin(1.002 * angle + 0.8)
            + 0.14 * np.sin(2.003 * angle + 1.7)
            + 0.07 * np.sin(0.5 * angle + 0.2)
        )
        signal *= envelope(size, sample_rate, 1.65, 1.9)
    elif name == "sovereign-pad":
        drift = 0.009 * np.sin(2.0 * math.pi * 0.045 * time)
        signal = (
            0.92 * np.sin(angle + drift)
            + 0.37 * np.sin(1.501 * angle + 0.45)
            + 0.24 * np.sin(2.002 * angle + 1.25)
            + 0.16 * np.sin(3.006 * angle + 2.1)
            + 0.12 * np.sin(0.5 * angle + 0.72)
        )
        signal *= envelope(size, sample_rate, 2.15, 2.0)
    elif name == "pixel-pad":
        signal = sum(
            (1.0 / harmonic) * np.sin(harmonic * angle + harmonic * 0.07)
            for harmonic in (1, 3, 5, 7)
        )
        signal += 0.18 * np.sin(0.5 * angle + 0.4)
        signal *= envelope(size, sample_rate, 0.018, 0.08)
    elif name == "pixel-lead":
        duty = 0.36 + 0.05 * np.sin(2.0 * math.pi * 0.7 * time)
        phase_cycle = np.mod(frequency * time + phase / (2.0 * math.pi), 1.0)
        signal = np.where(phase_cycle < duty, 1.0, -1.0)
        signal += 0.16 * np.sin(2.0 * angle)
        signal *= envelope(size, sample_rate, 0.003, 0.045, decay=max(0.05, seconds * 0.7))
    elif name == "bubble-pad":
        wobble = 0.035 * np.sin(2.0 * math.pi * 0.22 * time)
        signal = (
            np.sin(angle + wobble)
            + 0.32 * np.sin(2.003 * angle + 0.5)
            + 0.17 * np.sin(3.997 * angle + 1.4)
            + 0.09 * np.sin(0.5 * angle + 0.2)
        )
        signal *= envelope(size, sample_rate, 0.42, 0.72)
    elif name == "bubble-pluck":
        glide = angle * (1.0 + 0.045 * np.exp(-time * 14.0))
        signal = (
            np.sin(glide)
            + 0.46 * np.sin(2.71 * glide + 0.3)
            + 0.20 * np.sin(4.08 * glide + 1.1)
        )
        signal *= envelope(size, sample_rate, 0.002, 0.12, decay=max(0.05, seconds * 0.25))
    elif name == "vanguard-pad":
        drift = 0.006 * np.sin(2.0 * math.pi * 0.06 * time)
        signal = (
            0.90 * np.sin(angle + drift)
            + 0.42 * np.sin(2.0 * angle + 0.18)
            + 0.27 * np.sin(3.0 * angle + 0.5)
            + 0.14 * np.sin(4.0 * angle + 1.1)
            + 0.10 * np.sin(0.5 * angle + 0.8)
        )
        signal *= envelope(size, sample_rate, 0.55, 0.92)
    elif name == "vanguard-brass":
        signal = sum(
            (0.9 / (harmonic**1.08)) * np.sin(harmonic * angle + 0.09 * harmonic)
            for harmonic in range(1, 7)
        )
        signal *= envelope(size, sample_rate, 0.045, 0.28, decay=max(0.2, seconds * 1.6))
    elif name == "chime":
        signal = (
            np.sin(angle)
            + 0.42 * np.sin(2.01 * angle + 0.2)
            + 0.22 * np.sin(3.99 * angle + 1.1)
            + 0.09 * np.sin(6.02 * angle + 0.5)
        )
        signal *= envelope(size, sample_rate, 0.004, 0.18, decay=max(0.1, seconds * 0.42))
    elif name == "glass":
        signal = (
            np.sin(angle)
            + 0.53 * np.sin(2.756 * angle + 0.3)
            + 0.29 * np.sin(5.404 * angle + 1.2)
            + 0.12 * np.sin(8.933 * angle + 0.9)
        )
        signal *= envelope(size, sample_rate, 0.003, 0.22, decay=max(0.08, seconds * 0.33))
    elif name == "moon-bell":
        signal = (
            np.sin(angle)
            + 0.34 * np.sin(2.006 * angle + 0.28)
            + 0.16 * np.sin(3.012 * angle + 1.3)
            + 0.07 * np.sin(5.001 * angle + 0.84)
        )
        signal *= envelope(size, sample_rate, 0.006, 0.32, decay=max(0.14, seconds * 0.5))
    elif name == "obsidian":
        signal = (
            np.sin(angle)
            + 0.46 * np.sin(1.498 * angle + 0.5)
            + 0.23 * np.sin(2.113 * angle + 1.65)
            + 0.10 * np.sin(3.781 * angle + 0.9)
        )
        signal *= envelope(size, sample_rate, 0.008, 0.3, decay=max(0.12, seconds * 0.46))
    elif name == "pluck":
        signal = sum(
            (1.0 / (harmonic**1.22)) * np.sin(harmonic * angle + harmonic * 0.11)
            for harmonic in range(1, 8)
        )
        signal *= envelope(size, sample_rate, 0.003, 0.12, decay=max(0.06, seconds * 0.28))
    elif name == "analog":
        signal = sum(
            (1.0 / harmonic) * np.sin(harmonic * angle + 0.23)
            for harmonic in range(1, 9)
        )
        signal += 0.32 * np.sin(0.997 * angle + 1.2)
        signal *= envelope(size, sample_rate, 0.008, 0.10, decay=max(0.07, seconds * 0.36))
    elif name == "bass":
        signal = np.sin(angle) + 0.28 * np.sin(2.0 * angle) + 0.10 * np.sin(3.0 * angle)
        signal *= envelope(size, sample_rate, 0.025, 0.16)
    else:
        signal = np.sin(angle) * envelope(size, sample_rate, 0.006, 0.08)
    return signal.astype(np.float32)


def add_segment(
    target: np.ndarray,
    signal: np.ndarray,
    start_seconds: float,
    *,
    amplitude: float,
    pan: float = 0.0,
    wrap: bool = True,
) -> None:
    total = target.shape[0]
    start = round(start_seconds * MUSIC_RATE)
    left = math.cos((max(-1.0, min(1.0, pan)) + 1.0) * math.pi / 4.0)
    right = math.sin((max(-1.0, min(1.0, pan)) + 1.0) * math.pi / 4.0)
    stereo = np.column_stack((signal * amplitude * left, signal * amplitude * right))
    if not wrap:
        start = max(0, start)
        end = min(total, start + stereo.shape[0])
        if end > start:
            target[start:end] += stereo[: end - start]
        return
    start %= total
    first = min(stereo.shape[0], total - start)
    target[start : start + first] += stereo[:first]
    remaining = stereo.shape[0] - first
    cursor = first
    while remaining > 0:
        count = min(remaining, total)
        target[:count] += stereo[cursor : cursor + count]
        cursor += count
        remaining -= count


def add_note(
    target: np.ndarray,
    start: float,
    seconds: float,
    note: float,
    amplitude: float,
    name: str,
    *,
    pan: float = 0.0,
) -> None:
    add_segment(
        target,
        voice(name, midi(note), seconds, MUSIC_RATE),
        start,
        amplitude=amplitude,
        pan=pan,
    )


def add_noise_swell(
    target: np.ndarray,
    start: float,
    seconds: float,
    amplitude: float,
    *,
    pan: float,
    bright: bool = False,
) -> None:
    size = max(1, round(seconds * MUSIC_RATE))
    noise = RNG.normal(0.0, 1.0, size + 48).astype(np.float32)
    width = 5 if bright else 31
    kernel = np.ones(width, dtype=np.float32) / width
    filtered = np.convolve(noise, kernel, mode="valid")[:size]
    if bright:
        filtered = np.concatenate(([0.0], np.diff(filtered))).astype(np.float32)
        filtered /= max(1e-6, float(np.max(np.abs(filtered))))
    filtered *= np.sin(np.linspace(0.0, math.pi, size, dtype=np.float32)) ** 2
    add_segment(target, filtered, start, amplitude=amplitude, pan=pan)


def add_kick(target: np.ndarray, start: float, amplitude: float) -> None:
    seconds = 0.34
    size = round(seconds * MUSIC_RATE)
    time = np.arange(size, dtype=np.float32) / MUSIC_RATE
    phase = 2.0 * math.pi * (
        82.0 * time + (34.0 - 82.0) * (time**2) / (2.0 * seconds)
    )
    signal = np.sin(phase) * np.exp(-time * 13.0)
    add_segment(target, signal, start, amplitude=amplitude, pan=0.0)


def circular_space(
    source: np.ndarray,
    *,
    delays: tuple[tuple[float, float, float], ...],
) -> np.ndarray:
    output = source.copy()
    for seconds, gain, pan_shift in delays:
        samples = round(seconds * MUSIC_RATE)
        delayed = np.roll(source, samples, axis=0)
        if pan_shift:
            delayed = delayed[:, ::-1] * (1.0 - abs(pan_shift) * 0.12)
        output += delayed * gain
    return output


def finish_music(source: np.ndarray) -> np.ndarray:
    # Make the encoded loop boundary quiet and continuous without fading the
    # whole phrase to silence.
    crossfade = round(0.08 * MUSIC_RATE)
    blend = np.linspace(0.0, 1.0, crossfade, dtype=np.float32)[:, None]
    source[-crossfade:] = source[-crossfade:] * (1.0 - blend) + source[:crossfade] * blend
    source = np.tanh(source * 1.08)
    rms = float(np.sqrt(np.mean(source**2)))
    peak = float(np.max(np.abs(source)))
    scale = min(0.89 / max(peak, 1e-6), (10.0 ** (-20.0 / 20.0)) / max(rms, 1e-6))
    return np.clip(source * scale, -0.92, 0.92).astype(np.float32)


def finish_pulse(source: np.ndarray) -> np.ndarray:
    """Finish a quieter loop designed to sit below its synchronized score."""
    crossfade = round(0.08 * MUSIC_RATE)
    blend = np.linspace(0.0, 1.0, crossfade, dtype=np.float32)[:, None]
    source[-crossfade:] = source[-crossfade:] * (1.0 - blend) + source[:crossfade] * blend
    source = np.tanh(source * 1.04)
    rms = float(np.sqrt(np.mean(source**2)))
    peak = float(np.max(np.abs(source)))
    scale = min(0.78 / max(peak, 1e-6), (10.0 ** (-24.0 / 20.0)) / max(rms, 1e-6))
    return np.clip(source * scale, -0.82, 0.82).astype(np.float32)


def compose_atlas() -> np.ndarray:
    mix = np.zeros((round(TRACK_SECONDS * MUSIC_RATE), 2), dtype=np.float32)
    beat = 1.0
    bar = beat * 4.0
    chords = (
        (50, (50, 54, 57, 61, 64)),
        (49, (49, 52, 57, 61, 64)),
        (47, (47, 50, 54, 57, 62)),
        (43, (43, 47, 50, 54, 57)),
        (42, (42, 45, 50, 54, 57)),
        (45, (45, 49, 52, 55, 59)),
        (43, (43, 47, 50, 54, 59)),
        (45, (45, 50, 52, 57, 62)),
    )
    progression = chords + chords
    for bar_index, (root, chord) in enumerate(progression):
        start = bar_index * bar
        for voice_index, note in enumerate(chord):
            add_note(
                mix,
                start - 0.18,
                bar + 0.55,
                note,
                0.024,
                "atlas-pad",
                pan=-0.72 + voice_index * 0.36,
            )
        add_note(mix, start, bar * 0.92, root - 12, 0.032, "bass", pan=-0.08)
        if bar_index % 2 == 0:
            melody = (69, 73, 71, 66, 69, 74, 73, 76)[bar_index // 2]
            add_note(mix, start + 1.5 * beat, 2.2, melody, 0.044, "chime", pan=0.34)
        if bar_index in (3, 7, 11, 15):
            add_noise_swell(mix, start + 2.2, 1.7, 0.010, pan=-0.55, bright=False)
    return finish_music(
        circular_space(
            mix,
            delays=((0.375, 0.13, 0.2), (0.75, 0.08, -0.2), (2.0, 0.055, 0.1)),
        )
    )


def compose_aurora() -> np.ndarray:
    mix = np.zeros((round(TRACK_SECONDS * MUSIC_RATE), 2), dtype=np.float32)
    beat = 60.0 / 75.0
    bar = beat * 4.0
    chords = (
        (48, (48, 52, 55, 59, 62)),
        (50, (50, 54, 57, 59, 64)),
        (52, (52, 55, 59, 62, 66)),
        (55, (55, 59, 62, 66, 69)),
        (57, (57, 60, 64, 67, 71)),
        (52, (52, 55, 59, 62, 66)),
        (50, (50, 54, 57, 62, 64)),
        (55, (55, 59, 62, 64, 69)),
        (48, (48, 52, 55, 59, 62)),
        (55, (55, 59, 62, 66, 69)),
    )
    progression = chords + chords
    for bar_index, (root, chord) in enumerate(progression):
        start = bar_index * bar
        for voice_index, note in enumerate(chord):
            add_note(
                mix,
                start - 0.3,
                bar + 0.9,
                note,
                0.021,
                "aurora-pad",
                pan=-0.78 + voice_index * 0.39,
            )
        add_note(mix, start, bar * 0.86, root - 12, 0.019, "bass", pan=0.12)
        if bar_index % 4 == 2:
            add_note(mix, start + beat, 3.1, chord[-1] + 12, 0.035, "glass", pan=0.18)
        if bar_index % 5 == 4:
            add_noise_swell(mix, start + 1.0, 2.0, 0.013, pan=0.62, bright=True)
    return finish_music(
        circular_space(
            mix,
            delays=((0.32, 0.15, 0.3), (0.64, 0.10, -0.3), (1.6, 0.065, 0.2)),
        )
    )


def compose_foundry() -> np.ndarray:
    mix = np.zeros((round(TRACK_SECONDS * MUSIC_RATE), 2), dtype=np.float32)
    beat = 60.0 / 90.0
    bar = beat * 4.0
    chords = (
        (40, (40, 43, 47, 50, 54)),
        (36, (36, 40, 43, 47, 52)),
        (43, (43, 47, 50, 54, 59)),
        (38, (38, 42, 45, 50, 52)),
        (40, (40, 43, 47, 50, 54)),
        (36, (36, 40, 43, 47, 52)),
        (45, (45, 48, 52, 55, 59)),
        (47, (47, 50, 54, 59, 64)),
    )
    progression = chords * 3
    for bar_index, (root, chord) in enumerate(progression):
        start = bar_index * bar
        for voice_index, note in enumerate(chord):
            add_note(
                mix,
                start - 0.1,
                bar + 0.32,
                note,
                0.018,
                "foundry-pad",
                pan=-0.68 + voice_index * 0.34,
            )
        add_note(mix, start, bar * 0.94, root - 12, 0.048, "bass", pan=-0.02)
        if bar_index in (7, 15, 23):
            add_noise_swell(mix, start + 1.1, 1.3, 0.012, pan=0.35, bright=True)
    return finish_music(
        circular_space(
            mix,
            delays=((beat * 0.75, 0.105, 0.25), (beat * 1.5, 0.06, -0.25)),
        )
    )


def compose_lunar() -> np.ndarray:
    """A quiet moonlit garden of soft bells, suspended pads, and slow breath."""
    mix = np.zeros((round(TRACK_SECONDS * MUSIC_RATE), 2), dtype=np.float32)
    beat = 1.0
    bar = beat * 4.0
    chords = (
        (45, (45, 48, 52, 57, 60)),
        (43, (43, 47, 50, 55, 59)),
        (40, (40, 45, 48, 52, 57)),
        (48, (48, 52, 55, 60, 64)),
        (45, (45, 48, 52, 57, 60)),
        (50, (50, 53, 57, 60, 65)),
        (43, (43, 47, 50, 55, 59)),
        (40, (40, 45, 48, 52, 57)),
    )
    for bar_index, (root, chord) in enumerate(chords + chords):
        start = bar_index * bar
        for voice_index, note in enumerate(chord):
            add_note(
                mix,
                start - 0.42,
                bar + 1.1,
                note,
                0.019,
                "lunar-pad",
                pan=-0.76 + voice_index * 0.38,
            )
        add_note(mix, start, bar * 0.84, root - 12, 0.018, "bass", pan=-0.12)
        if bar_index % 4 == 2:
            add_note(mix, start + 1.35, 2.8, chord[-1] + 12, 0.029, "moon-bell", pan=0.24)
        if bar_index in (3, 7, 11, 15):
            add_noise_swell(mix, start + 1.7, 2.0, 0.008, pan=-0.42, bright=False)
    return finish_music(
        circular_space(
            mix,
            delays=((0.5, 0.13, 0.18), (1.0, 0.08, -0.18), (2.5, 0.055, 0.1)),
        )
    )


def compose_eclipse() -> np.ndarray:
    """A regal shadow-court score built from additive choir-like pads and obsidian chimes."""
    mix = np.zeros((round(TRACK_SECONDS * MUSIC_RATE), 2), dtype=np.float32)
    beat = 60.0 / 75.0
    bar = beat * 4.0
    chords = (
        (36, (36, 39, 43, 48, 51)),
        (34, (34, 38, 41, 46, 50)),
        (31, (31, 36, 39, 43, 48)),
        (39, (39, 43, 46, 51, 55)),
        (36, (36, 39, 43, 48, 51)),
        (41, (41, 44, 48, 53, 56)),
        (34, (34, 38, 41, 46, 50)),
        (43, (43, 46, 50, 55, 58)),
        (39, (39, 43, 46, 51, 55)),
        (36, (36, 41, 43, 48, 53)),
    )
    for bar_index, (root, chord) in enumerate(chords + chords):
        start = bar_index * bar
        for voice_index, note in enumerate(chord):
            add_note(
                mix,
                start - 0.58,
                bar + 1.45,
                note,
                0.018,
                "sovereign-pad",
                pan=-0.72 + voice_index * 0.36,
            )
        add_note(mix, start, bar * 0.9, root - 12, 0.034, "bass", pan=0.04)
        if bar_index % 5 == 4:
            for offset, note in ((0.0, chord[1] + 12), (0.22, chord[3] + 12), (0.46, chord[-1] + 12)):
                add_note(mix, start + 1.6 + offset, 2.15, note, 0.023, "obsidian", pan=offset - 0.24)
        if bar_index in (4, 9, 14, 19):
            add_noise_swell(mix, start + 1.0, 1.8, 0.010, pan=0.38, bright=False)
    return finish_music(
        circular_space(
            mix,
            delays=((0.4, 0.115, 0.28), (0.8, 0.075, -0.28), (2.4, 0.06, 0.12)),
        )
    )


def compose_pixel_frontier() -> np.ndarray:
    """An original 16-bit odyssey of pulse leads, arpeggios, and tiny noise drums."""
    mix = np.zeros((round(TRACK_SECONDS * MUSIC_RATE), 2), dtype=np.float32)
    beat = 0.5
    bar = beat * 4.0
    chords = (
        (45, (45, 52, 57, 60)),
        (41, (41, 48, 53, 57)),
        (48, (48, 55, 60, 64)),
        (43, (43, 50, 55, 59)),
        (45, (45, 52, 57, 60)),
        (53, (53, 57, 60, 65)),
        (50, (50, 55, 59, 62)),
        (43, (43, 50, 55, 60)),
    )
    melody = (69, 72, 76, 72, 67, 71, 74, 79, 76, 72, 69, 67, 65, 69, 72, 74)
    for bar_index, (root, chord) in enumerate(chords * 4):
        start = bar_index * bar
        for voice_index, note in enumerate(chord):
            add_note(
                mix,
                start,
                bar * 0.96,
                note,
                0.013,
                "pixel-pad",
                pan=-0.54 + voice_index * 0.36,
            )
        add_note(mix, start, beat * 1.75, root - 12, 0.030, "bass", pan=0.0)
        add_note(mix, start + beat * 2.0, beat * 1.75, root - 12, 0.024, "bass", pan=0.0)
        for step, interval in enumerate((0, 7, 12, 7, 3, 7, 12, 15)):
            add_note(
                mix,
                start + step * beat / 2.0,
                beat * 0.28,
                root + 12 + interval,
                0.021 if step in (0, 4) else 0.014,
                "pixel-lead",
                pan=-0.42 if step % 2 else 0.42,
            )
        if bar_index % 2 == 0:
            add_note(
                mix,
                start + beat,
                beat * 1.65,
                melody[(bar_index // 2) % len(melody)],
                0.034,
                "pixel-lead",
                pan=0.16,
            )
        add_kick(mix, start, 0.020)
        add_kick(mix, start + beat * 2.0, 0.014)
        add_noise_swell(mix, start + beat * 1.0, 0.08, 0.007, pan=-0.18, bright=True)
        add_noise_swell(mix, start + beat * 3.0, 0.08, 0.008, pan=0.18, bright=True)
    return finish_music(
        circular_space(
            mix,
            delays=((beat * 0.5, 0.055, 0.25), (beat, 0.035, -0.25)),
        )
    )


def compose_bubble_reef() -> np.ndarray:
    """A buoyant original reef score of elastic bass, coral plucks, and bubble tones."""
    mix = np.zeros((round(TRACK_SECONDS * MUSIC_RATE), 2), dtype=np.float32)
    beat = 60.0 / 75.0
    bar = beat * 4.0
    chords = (
        (48, (48, 52, 55, 60, 64)),
        (55, (55, 59, 62, 67, 71)),
        (53, (53, 57, 60, 65, 69)),
        (57, (57, 60, 64, 69, 72)),
        (50, (50, 55, 59, 62, 67)),
        (52, (52, 55, 60, 64, 67)),
        (45, (45, 52, 57, 60, 64)),
        (55, (55, 59, 62, 65, 71)),
        (53, (53, 57, 60, 64, 69)),
        (50, (50, 55, 59, 62, 67)),
    )
    for bar_index, (root, chord) in enumerate(chords * 2):
        start = bar_index * bar
        for voice_index, note in enumerate(chord):
            add_note(
                mix,
                start - 0.16,
                bar + 0.42,
                note,
                0.015,
                "bubble-pad",
                pan=-0.72 + voice_index * 0.36,
            )
        add_note(mix, start, beat * 1.7, root - 12, 0.027, "bass", pan=-0.04)
        add_note(mix, start + beat * 2.0, beat * 1.6, root - 5, 0.021, "bass", pan=0.04)
        pattern = (0, 7, 12, 9, 4, 12, 16, 7)
        for step, interval in enumerate(pattern):
            if step in ((2, 6) if bar_index % 2 else (3, 7)):
                continue
            add_note(
                mix,
                start + step * beat / 2.0,
                beat * 0.48,
                root + 12 + interval,
                0.025 if step in (0, 4) else 0.018,
                "bubble-pluck",
                pan=-0.5 + (step % 4) * 0.33,
            )
        if bar_index % 4 == 3:
            for offset, note in ((0.0, chord[1] + 12), (0.12, chord[3] + 12), (0.27, chord[-1] + 12)):
                add_note(mix, start + beat * 2.5 + offset, 0.72, note, 0.025, "bubble-pluck", pan=offset - 0.12)
            add_noise_swell(mix, start + beat * 2.4, beat * 0.9, 0.006, pan=0.42, bright=False)
    return finish_music(
        circular_space(
            mix,
            delays=((beat * 0.5, 0.085, 0.32), (beat * 1.5, 0.045, -0.32)),
        )
    )


def compose_stellar_vanguard() -> np.ndarray:
    """A broad original space-opera overture without borrowed motifs or signature effects."""
    mix = np.zeros((round(TRACK_SECONDS * MUSIC_RATE), 2), dtype=np.float32)
    beat = 60.0 / 75.0
    bar = beat * 4.0
    chords = (
        (38, (38, 45, 50, 53, 57)),
        (34, (34, 41, 46, 50, 53)),
        (41, (41, 48, 53, 57, 60)),
        (36, (36, 43, 48, 52, 55)),
        (43, (43, 50, 55, 58, 62)),
        (39, (39, 46, 51, 55, 58)),
        (45, (45, 52, 57, 60, 64)),
        (41, (41, 48, 53, 57, 60)),
        (34, (34, 41, 46, 50, 53)),
        (38, (38, 45, 50, 53, 57)),
    )
    calls = ((0.0, 57), (0.42, 62), (0.92, 65), (1.62, 60))
    for bar_index, (root, chord) in enumerate(chords * 2):
        start = bar_index * bar
        for voice_index, note in enumerate(chord):
            add_note(
                mix,
                start - 0.32,
                bar + 0.88,
                note,
                0.018,
                "vanguard-pad",
                pan=-0.72 + voice_index * 0.36,
            )
        add_note(mix, start, bar * 0.92, root - 12, 0.038, "bass", pan=0.0)
        if bar_index % 2 == 0:
            for offset, interval in calls:
                add_note(
                    mix,
                    start + beat * 0.5 + offset,
                    0.72,
                    root + interval - 38,
                    0.022,
                    "vanguard-brass",
                    pan=-0.18 + offset * 0.2,
                )
        add_kick(mix, start, 0.022)
        add_kick(mix, start + beat * 2.0, 0.014)
        if bar_index in (4, 9, 14, 19):
            add_noise_swell(mix, start + beat * 1.2, beat * 2.2, 0.010, pan=0.28, bright=False)
    return finish_music(
        circular_space(
            mix,
            delays=((beat, 0.095, 0.24), (beat * 2.0, 0.055, -0.24), (2.4, 0.04, 0.1)),
        )
    )


def compose_pulse(theme: str) -> np.ndarray:
    """Build a 64-second rhythm layer phase-locked to a theme's score."""
    configurations = {
        "atlas": {
            "beat": 1.0,
            "roots": (50, 49, 47, 43, 42, 45, 43, 45) * 2,
            "voice": "pluck",
            "pattern": (0, 7, 12, 7, 3, 12, 15, 7),
            "gain": 0.040,
        },
        "aurora": {
            "beat": 60.0 / 75.0,
            "roots": (48, 50, 52, 55, 57, 52, 50, 55, 48, 55) * 2,
            "voice": "glass",
            "pattern": (0, 7, 12, 14, 7, 12, 19, 14),
            "gain": 0.034,
        },
        "foundry": {
            "beat": 60.0 / 90.0,
            "roots": (40, 36, 43, 38, 40, 36, 45, 47) * 3,
            "voice": "analog",
            "pattern": (0, 12, 7, 15, 0, 12, 10, 7),
            "gain": 0.046,
        },
        "lunar": {
            "beat": 1.0,
            "roots": (45, 43, 40, 48, 45, 50, 43, 40) * 2,
            "voice": "moon-bell",
            "pattern": (0, 7, 12, 7, 3, 12, 15, 10),
            "gain": 0.029,
        },
        "eclipse": {
            "beat": 60.0 / 75.0,
            "roots": (36, 34, 31, 39, 36, 41, 34, 43, 39, 36) * 2,
            "voice": "obsidian",
            "pattern": (0, 7, 12, 15, 7, 12, 19, 15),
            "gain": 0.038,
        },
        "pixel": {
            "beat": 0.5,
            "roots": (45, 41, 48, 43, 45, 53, 50, 43) * 4,
            "voice": "pixel-lead",
            "pattern": (0, 7, 12, 7, 3, 12, 15, 10),
            "gain": 0.034,
        },
        "bubble": {
            "beat": 60.0 / 75.0,
            "roots": (48, 55, 53, 57, 50, 52, 45, 55, 53, 50) * 2,
            "voice": "bubble-pluck",
            "pattern": (0, 7, 12, 9, 4, 12, 16, 7),
            "gain": 0.032,
        },
        "vanguard": {
            "beat": 60.0 / 75.0,
            "roots": (38, 34, 41, 36, 43, 39, 45, 41, 34, 38) * 2,
            "voice": "vanguard-brass",
            "pattern": (0, 7, 12, 15, 7, 12, 17, 15),
            "gain": 0.032,
        },
    }
    config = configurations[theme]
    beat = config["beat"]
    bar = beat * 4.0
    mix = np.zeros((round(TRACK_SECONDS * MUSIC_RATE), 2), dtype=np.float32)
    for bar_index, root in enumerate(config["roots"]):
        start = bar_index * bar
        for step, interval in enumerate(config["pattern"]):
            if theme == "lunar" and step not in (0, 3, 5, 7):
                continue
            accent = 1.22 if step in (0, 4) else 0.78
            add_note(
                mix,
                start + step * beat / 2.0,
                max(0.16, beat * (0.43 if theme == "lunar" else 0.31)),
                root + 12 + interval,
                config["gain"] * accent,
                config["voice"],
                pan=-0.38 if step % 2 else 0.38,
            )
        if theme in ("foundry", "eclipse", "pixel", "vanguard"):
            kick_gain = {
                "foundry": (0.035, 0.022),
                "eclipse": (0.024, 0.015),
                "pixel": (0.021, 0.014),
                "vanguard": (0.025, 0.016),
            }[theme]
            add_kick(mix, start, kick_gain[0])
            add_kick(mix, start + beat * 2.0, kick_gain[1])
        elif theme == "atlas" and bar_index % 2 == 0:
            add_note(mix, start, 0.24, root, 0.025, "pluck", pan=0.0)
        if theme == "aurora" and bar_index % 5 == 4:
            add_noise_swell(mix, start + beat * 3.0, beat, 0.006, pan=0.4, bright=True)
        if theme == "lunar" and bar_index % 4 == 3:
            add_noise_swell(mix, start + beat * 2.5, beat * 1.2, 0.004, pan=-0.3)
        if theme == "bubble" and bar_index % 4 == 3:
            add_noise_swell(mix, start + beat * 2.5, beat, 0.005, pan=0.35, bright=False)
        if theme == "pixel":
            add_noise_swell(mix, start + beat * 1.0, 0.07, 0.004, pan=-0.2, bright=True)
            add_noise_swell(mix, start + beat * 3.0, 0.07, 0.005, pan=0.2, bright=True)
    delay = beat * (0.75 if theme in ("aurora", "lunar", "bubble") else 0.5)
    return finish_pulse(circular_space(mix, delays=((delay, 0.075, 0.22),)))


def sfx_tone(
    target: np.ndarray,
    start: float,
    seconds: float,
    note: float,
    amplitude: float,
    voice_name: str,
    *,
    theme: str,
) -> None:
    theme_pitch = {
        "atlas": 1.0,
        "aurora": 1.12,
        "foundry": 0.88,
        "lunar": 0.96,
        "eclipse": 0.76,
        "pixel": 1.04,
        "bubble": 1.16,
        "vanguard": 0.82,
    }[theme]
    frequency = midi(note) * theme_pitch
    signal = voice(voice_name, frequency, seconds, SFX_RATE)
    begin = round(start * SFX_RATE)
    end = min(target.shape[0], begin + signal.shape[0])
    if end > begin:
        target[begin:end] += signal[: end - begin] * amplitude


def sfx_noise(
    target: np.ndarray,
    start: float,
    seconds: float,
    amplitude: float,
    *,
    bright: bool,
) -> None:
    size = max(1, round(seconds * SFX_RATE))
    noise = RNG.normal(0.0, 1.0, size + 32).astype(np.float32)
    width = 3 if bright else 21
    filtered = np.convolve(noise, np.ones(width, dtype=np.float32) / width, mode="valid")[:size]
    if bright:
        filtered = np.concatenate(([0.0], np.diff(filtered))).astype(np.float32)
        filtered /= max(1e-6, float(np.max(np.abs(filtered))))
    filtered *= envelope(size, SFX_RATE, 0.005, max(0.03, seconds * 0.58), decay=max(0.04, seconds * 0.42))
    begin = round(start * SFX_RATE)
    end = min(target.shape[0], begin + size)
    if end > begin:
        target[begin:end] += filtered[: end - begin] * amplitude


def compose_sfx_bank(theme: str) -> np.ndarray:
    total_seconds = len(SFX_CUES) * SFX_SLOT_SECONDS
    bank = np.zeros(round(total_seconds * SFX_RATE), dtype=np.float32)
    voice_name = {
        "atlas": "chime",
        "aurora": "glass",
        "foundry": "analog",
        "lunar": "moon-bell",
        "eclipse": "obsidian",
        "pixel": "pixel-lead",
        "bubble": "bubble-pluck",
        "vanguard": "vanguard-brass",
    }[theme]
    gain = {
        "atlas": 1.0,
        "aurora": 0.86,
        "foundry": 0.96,
        "lunar": 0.82,
        "eclipse": 0.9,
        "pixel": 0.84,
        "bubble": 0.82,
        "vanguard": 0.88,
    }[theme]

    def cue(index: int) -> float:
        return index * SFX_SLOT_SECONDS + 0.045

    # place
    sfx_tone(bank, cue(0), 0.20, 59, 0.30 * gain, voice_name, theme=theme)
    if theme in ("foundry", "eclipse", "pixel", "vanguard"):
        sfx_noise(bank, cue(0), 0.09, 0.08, bright=True)
    # combineStart
    sfx_tone(bank, cue(1), 0.30, 52, 0.25 * gain, voice_name, theme=theme)
    sfx_tone(bank, cue(1) + 0.10, 0.33, 59, 0.27 * gain, voice_name, theme=theme)
    sfx_noise(bank, cue(1), 0.28, 0.045, bright=theme != "atlas")
    # success
    sfx_tone(bank, cue(2), 0.42, 64, 0.25 * gain, voice_name, theme=theme)
    sfx_tone(bank, cue(2) + 0.13, 0.54, 71, 0.31 * gain, voice_name, theme=theme)
    # reject
    reject_voice = {
        "foundry": "analog",
        "eclipse": "obsidian",
        "pixel": "pixel-lead",
        "bubble": "bubble-pluck",
        "vanguard": "vanguard-brass",
    }.get(theme, "pluck")
    sfx_tone(bank, cue(3), 0.24, 50, 0.22 * gain, reject_voice, theme=theme)
    sfx_tone(bank, cue(3) + 0.12, 0.28, 47, 0.18 * gain, reject_voice, theme=theme)
    # twist
    for offset, note, amplitude in ((0.00, 62, 0.21), (0.15, 69, 0.25), (0.31, 78, 0.28)):
        sfx_tone(bank, cue(4) + offset, 0.72, note, amplitude * gain, voice_name, theme=theme)
    sfx_noise(bank, cue(4) + 0.10, 0.52, 0.04, bright=True)
    # target
    for offset, note, amplitude in ((0.00, 57, 0.20), (0.16, 64, 0.23), (0.32, 69, 0.26), (0.50, 76, 0.30)):
        sfx_tone(bank, cue(5) + offset, 0.72, note, amplitude * gain, voice_name, theme=theme)
    # sense
    for offset, note in ((0.00, 55), (0.18, 62), (0.36, 74)):
        sfx_tone(bank, cue(6) + offset, 0.55, note, 0.22 * gain, voice_name, theme=theme)
    # mastery
    for offset, note in ((0.00, 67), (0.17, 72), (0.34, 76)):
        sfx_tone(bank, cue(7) + offset, 0.58, note, 0.24 * gain, voice_name, theme=theme)
    # ghostPass
    sfx_noise(bank, cue(8), 0.34, 0.05, bright=True)
    sfx_tone(bank, cue(8), 0.32, 59, 0.20 * gain, voice_name, theme=theme)
    sfx_tone(bank, cue(8) + 0.11, 0.38, 66, 0.24 * gain, voice_name, theme=theme)
    # gateClose
    sfx_noise(bank, cue(9), 0.72, 0.055, bright=False)
    for offset, note in ((0.00, 57), (0.16, 50), (0.33, 43)):
        sfx_tone(bank, cue(9) + offset, 0.52, note, 0.21 * gain, voice_name, theme=theme)
    # gateOpen
    sfx_noise(bank, cue(10), 0.66, 0.045, bright=True)
    for offset, note in ((0.00, 43), (0.15, 55), (0.31, 64)):
        sfx_tone(bank, cue(10) + offset, 0.60, note, 0.22 * gain, voice_name, theme=theme)
    # runStart
    for offset, note, amplitude in ((0.00, 48, 0.20), (0.14, 55, 0.24), (0.30, 67, 0.28)):
        sfx_tone(bank, cue(11) + offset, 0.55, note, amplitude * gain, voice_name, theme=theme)
    # resultReveal
    sfx_noise(bank, cue(12), 0.80, 0.035, bright=theme in ("aurora", "lunar", "bubble"))
    for offset, note in ((0.08, 52), (0.21, 59), (0.36, 64)):
        sfx_tone(bank, cue(12) + offset, 0.72, note, 0.22 * gain, voice_name, theme=theme)
    # homeReturn
    for offset, note in ((0.00, 67), (0.14, 59), (0.30, 52)):
        sfx_tone(bank, cue(13) + offset, 0.60, note, 0.20 * gain, voice_name, theme=theme)
    # timerWarning
    sfx_tone(bank, cue(14), 0.18, 79, 0.28 * gain, voice_name, theme=theme)
    sfx_tone(bank, cue(14) + 0.31, 0.22, 79, 0.30 * gain, voice_name, theme=theme)
    # timeout
    for offset, note in ((0.00, 55), (0.18, 48), (0.37, 40)):
        sfx_tone(bank, cue(15) + offset, 0.54, note, 0.22 * gain, voice_name, theme=theme)
    sfx_noise(bank, cue(15) + 0.30, 0.34, 0.045, bright=False)
    # failure
    for offset, note in ((0.00, 52), (0.18, 49), (0.38, 45)):
        sfx_tone(bank, cue(16) + offset, 0.64, note, 0.19 * gain, voice_name, theme=theme)
    # reward
    for offset, note in ((0.00, 72), (0.11, 79), (0.24, 84)):
        sfx_tone(bank, cue(17) + offset, 0.48, note, 0.23 * gain, voice_name, theme=theme)
    # collectionUnlock
    for offset, note in ((0.00, 55), (0.14, 62), (0.28, 67), (0.44, 74)):
        sfx_tone(bank, cue(18) + offset, 0.68, note, 0.23 * gain, voice_name, theme=theme)
    sfx_noise(bank, cue(18) + 0.20, 0.66, 0.035, bright=True)
    # rankPromotion
    for offset, note, amplitude in ((0.00, 48, 0.19), (0.13, 55, 0.22), (0.27, 60, 0.25), (0.43, 67, 0.30), (0.61, 72, 0.32)):
        sfx_tone(bank, cue(19) + offset, 0.70, note, amplitude * gain, voice_name, theme=theme)
    # Earth signature: low root and open fifth.
    sfx_tone(bank, cue(20), 0.62, 43, 0.27 * gain, voice_name, theme=theme)
    sfx_tone(bank, cue(20) + 0.14, 0.58, 50, 0.22 * gain, voice_name, theme=theme)
    # Water signature: a fluid suspended rise.
    for offset, note in ((0.00, 55), (0.12, 62), (0.27, 69)):
        sfx_tone(bank, cue(21) + offset, 0.60, note, 0.21 * gain, voice_name, theme=theme)
    # Fire signature: bright crackle and quick upward spark.
    sfx_noise(bank, cue(22), 0.42, 0.055, bright=True)
    for offset, note in ((0.00, 60), (0.09, 67), (0.19, 76)):
        sfx_tone(bank, cue(22) + offset, 0.42, note, 0.23 * gain, voice_name, theme=theme)
    # Air signature: breath followed by a high, open interval.
    sfx_noise(bank, cue(23), 0.68, 0.040, bright=False)
    sfx_tone(bank, cue(23) + 0.09, 0.64, 67, 0.20 * gain, voice_name, theme=theme)
    sfx_tone(bank, cue(23) + 0.25, 0.62, 79, 0.22 * gain, voice_name, theme=theme)

    bank = np.tanh(bank * 1.18)
    peak = float(np.max(np.abs(bank)))
    return np.clip(bank * (0.88 / max(peak, 1e-6)), -0.9, 0.9).astype(np.float32)


def write_wave(path: Path, samples: np.ndarray, sample_rate: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.clip(samples, -1.0, 1.0)
    pcm = (pcm * 32767.0).astype("<i2")
    channels = 1 if pcm.ndim == 1 else pcm.shape[1]
    with wave.open(str(path), "wb") as output:
        output.setnchannels(channels)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        output.writeframes(pcm.tobytes())


def encode_mp3(source: Path, destination: Path, bitrate: str) -> None:
    ffmpeg = os.environ.get("CONSTELLORE_FFMPEG") or shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is required to encode runtime MP3 assets.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-fflags",
            "+bitexact",
            "-i",
            str(source),
            "-map_metadata",
            "-1",
            "-codec:a",
            "libmp3lame",
            "-flags:a",
            "+bitexact",
            "-b:a",
            bitrate,
            "-write_xing",
            "1",
            str(destination),
        ],
        check=True,
    )


def build() -> None:
    tracks = (
        (
            "celestial-atlas",
            "charting-the-first-sky.mp3",
            compose_atlas,
            "atlas",
        ),
        (
            "aurora-archive",
            "frostglass-memory.mp3",
            compose_aurora,
            "aurora",
        ),
        (
            "solar-foundry",
            "the-orrery-turns.mp3",
            compose_foundry,
            "foundry",
        ),
        (
            "lunar-garden",
            "midnight-bloom.mp3",
            compose_lunar,
            "lunar",
        ),
        (
            "eclipse-sovereign",
            "crown-of-shadow.mp3",
            compose_eclipse,
            "eclipse",
        ),
        (
            "pixel-frontier",
            "bitstream-constellations.mp3",
            compose_pixel_frontier,
            "pixel",
        ),
        (
            "bubble-reef",
            "bubbles-beyond-the-blue.mp3",
            compose_bubble_reef,
            "bubble",
        ),
        (
            "stellar-vanguard",
            "beyond-the-silent-meridian.mp3",
            compose_stellar_vanguard,
            "vanguard",
        ),
    )
    with tempfile.TemporaryDirectory(prefix="constellore-audio-") as temp_name:
        temp = Path(temp_name)
        for slug, filename, composer, theme in tracks:
            music_wave = temp / f"{slug}-music.wav"
            pulse_wave = temp / f"{slug}-pulse.wav"
            sfx_wave = temp / f"{slug}-sfx.wav"
            print(f"Composing {slug} soundtrack…")
            write_wave(music_wave, composer(), MUSIC_RATE)
            encode_mp3(music_wave, OUTPUT / slug / filename, "72k")
            print(f"Composing {slug} gameplay pulse…")
            write_wave(pulse_wave, compose_pulse(theme), MUSIC_RATE)
            encode_mp3(pulse_wave, OUTPUT / slug / "gameplay-pulse.mp3", "40k")
            print(f"Composing {slug} sound bank…")
            write_wave(sfx_wave, compose_sfx_bank(theme), SFX_RATE)
            encode_mp3(sfx_wave, OUTPUT / slug / "sfx-bank.mp3", "64k")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        help="Override the runtime output directory (defaults to public/audio).",
    )
    arguments = parser.parse_args()
    global OUTPUT
    if arguments.output:
        OUTPUT = arguments.output.resolve()
    build()
    print(f"Audio assets written to {OUTPUT}")


if __name__ == "__main__":
    main()
