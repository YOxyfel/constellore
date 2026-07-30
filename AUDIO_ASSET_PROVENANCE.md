# Constellore audio asset provenance

## Scope and rights

All shipped music and sound effects in `public/audio/` are original project
assets created for Constellore on 2026-07-27 and 2026-07-28. They contain no third-party samples
or recordings, borrowed melodies or stems, generative-model output, trademarks,
or spoken material. The repository's normal all-rights-reserved license applies.

The assets are deterministic procedural synthesis from
`scripts/build-audio-assets.py`. NumPy is used only as an offline signal
processing tool and ffmpeg/libmp3lame only encodes the generated PCM masters;
neither tool nor library is shipped in the browser game.

## Runtime soundtrack

| Cosmetic sound theme | Track | Runtime file | Musical direction |
| --- | --- | --- | --- |
| Celestial Atlas / Cosmic Chimes | **Charting the First Sky** | `public/audio/celestial-atlas/charting-the-first-sky.mp3` | 60 BPM; calm celesta/chime partials, thread-like harp plucks, warm pads, and a D-major/B-minor constellation cadence |
| Aurora Archive / Glass Orbit | **Frostglass Memory** | `public/audio/aurora-archive/frostglass-memory.mp3` | 75 BPM; bowed-glass additive tones, crystalline mallets, airy pads, and cool Lydian color |
| Solar Foundry / Analog Stars | **The Orrery Turns** | `public/audio/solar-foundry/the-orrery-turns.mp3` | 90 BPM; warm analog harmonics, low pulse, tuned mechanisms, brass-like pads, and an ember-lit minor/Dorian motion |
| Lunar Garden / Moon Bells | **Midnight Bloom** | `public/audio/lunar-garden/midnight-bloom.mp3` | 60 BPM; soft moon-bell partials, slow suspended pads, restrained low resonance, and a nocturnal garden cadence |
| Eclipse Sovereign / Eclipse Choir | **Crown of Shadow** | `public/audio/eclipse-sovereign/crown-of-shadow.mp3` | 75 BPM; deep additive choir-like pads, dark obsidian chimes, low ceremonial resonance, and a regal minor progression |
| Pixel Frontier / Pixel Pulse | **Bitstream Constellations** | `public/audio/pixel-frontier/bitstream-constellations.mp3` | 120 BPM; original pulse leads, triangle-like bass, compact noise drums, and bright arcade arpeggios |
| Bubble Reef / Bubble Beat | **Bubbles Beyond the Blue** | `public/audio/bubble-reef/bubbles-beyond-the-blue.mp3` | 75 BPM; original coral-like additive plucks, elastic bass, warm reef pads, and playful syncopation |
| Stellar Vanguard / Void Overture | **Beyond the Silent Meridian** | `public/audio/stellar-vanguard/beyond-the-silent-meridian.mp3` | 75 BPM; original synthetic brass, broad suspended pads, low ceremonial percussion, and an expansive space-opera cadence |

Each score is a 64-second stereo loop rendered at 32 kHz. The source generator
wraps reverb and note tails around the loop, then applies an 80 ms boundary
crossfade. Runtime MP3s are constant-rate, broadly compatible delivery copies.
The final mixes target a quiet gameplay range around -20 LUFS and remain well
below full scale; playback is reduced further by the in-game music bus.

Measured runtime encodes:

- Charting the First Sky: -18.9 LUFS integrated, -7.0 dBFS true peak.
- Frostglass Memory: -18.4 LUFS integrated, -6.8 dBFS true peak.
- The Orrery Turns: -20.7 LUFS integrated, -9.7 dBFS true peak.
- Midnight Bloom: -18.8 LUFS integrated, -7.7 dBFS true peak.
- Crown of Shadow: -21.0 LUFS integrated, -6.3 dBFS true peak.
- Bitstream Constellations: -19.0 LUFS integrated, -7.0 dBFS true peak.
- Bubbles Beyond the Blue: -18.5 LUFS integrated, -7.3 dBFS true peak.
- Beyond the Silent Meridian: -19.9 LUFS integrated, -7.9 dBFS true peak.

The scores are intentionally instrumental, sparse, and low in midrange density
so they do not compete with a language-heavy puzzle.

## Synchronized gameplay pulse stems

Each theme also ships a 64-second gameplay-pulse stem:

- `public/audio/celestial-atlas/gameplay-pulse.mp3`
- `public/audio/aurora-archive/gameplay-pulse.mp3`
- `public/audio/solar-foundry/gameplay-pulse.mp3`
- `public/audio/lunar-garden/gameplay-pulse.mp3`
- `public/audio/eclipse-sovereign/gameplay-pulse.mp3`
- `public/audio/pixel-frontier/gameplay-pulse.mp3`
- `public/audio/bubble-reef/gameplay-pulse.mp3`
- `public/audio/stellar-vanguard/gameplay-pulse.mp3`

The eight stems are rendered from the same 32 kHz timeline and musical grid as
their parent scores. Runtime starts a theme's score and pulse together, keeps
the pulse muted outside an active run, and raises it gently during gameplay.
This adds forward motion without restarting the soundtrack or creating a seam
when the player moves between Home, a run, and results.

The stems use the same deterministic, sample-free synthesis as the scores:
rounded constellation motion for Celestial Atlas, refracted glass rhythm for
Aurora Archive, restrained mechanism patterns for Solar Foundry, soft
botanical bell motion for Lunar Garden, and a low ceremonial heartbeat for
Eclipse Sovereign. Pixel Frontier adds stepped pulse arpeggios and compact
noise percussion; Bubble Reef adds buoyant pluck syncopation; Stellar Vanguard
adds a restrained ceremonial brass pulse.

Measured pulse encodes and the maximum-intensity bed-plus-pulse mix:

| Theme | Pulse gain | Pulse encode | Pulse loudness / true peak | Combined loudness / true peak |
| --- | ---: | ---: | ---: | ---: |
| Celestial Atlas | 0.42 | 320,481 B | -21.4 LUFS / -3.0 dBFS | -18.6 LUFS / -6.1 dBFS |
| Aurora Archive | 0.38 | 320,481 B | -21.2 LUFS / -2.5 dBFS | -18.0 LUFS / -6.1 dBFS |
| Solar Foundry | 0.44 | 320,481 B | -22.2 LUFS / -2.9 dBFS | -20.2 LUFS / -7.7 dBFS |
| Lunar Garden | 0.32 | 320,481 B | -19.5 LUFS / -4.8 dBFS | -18.6 LUFS / -6.9 dBFS |
| Eclipse Sovereign | 0.40 | 320,481 B | -22.4 LUFS / -2.8 dBFS | -20.5 LUFS / -6.1 dBFS |
| Pixel Frontier | 0.40 | 320,480 B | -22.1 LUFS / -7.1 dBFS | -16.5 LUFS / -3.6 dBFS |
| Bubble Reef | 0.36 | 320,480 B | -21.6 LUFS / -3.4 dBFS | -16.2 LUFS / -1.1 dBFS |
| Stellar Vanguard | 0.38 | 320,480 B | -22.2 LUFS / -5.1 dBFS | -17.8 LUFS / -2.5 dBFS |

These measurements precede the theme music gain, master volume, and music
volume applied by the browser runtime. Both MP3s in a pair decode to 64.000
seconds and start at the same timestamp and sample offset.

## Word and fusion sound banks

Runtime files:

- `public/audio/celestial-atlas/sfx-bank.mp3`
- `public/audio/aurora-archive/sfx-bank.mp3`
- `public/audio/solar-foundry/sfx-bank.mp3`
- `public/audio/lunar-garden/sfx-bank.mp3`
- `public/audio/eclipse-sovereign/sfx-bank.mp3`
- `public/audio/pixel-frontier/sfx-bank.mp3`
- `public/audio/bubble-reef/sfx-bank.mp3`
- `public/audio/stellar-vanguard/sfx-bank.mp3`

Each 33.6-second mono bank contains 24 isolated 1.4-second cue slots in this
stable order:

| Cue | Purpose |
| --- | --- |
| `place` | A word settles onto the board. |
| `combineStart` | Two concepts begin a fusion. |
| `success` | A combination resolves successfully. |
| `reject` | A pair cannot combine. |
| `twist` | A run rule or cosmic twist activates. |
| `target` | The target concept receives emphasis. |
| `sense` | Sense assistance reveals useful direction. |
| `mastery` | A mastery milestone resolves. |
| `ghostPass` | A ghost or preview path hands play back to the player. |
| `gateClose` | The opening gate closes around the transition. |
| `gateOpen` | The gate opens onto the board. |
| `runStart` | Active play begins. |
| `resultReveal` | The result presentation is revealed. |
| `homeReturn` | The results flow returns to Home. |
| `timerWarning` | A timed run approaches its limit. |
| `timeout` | The run timer expires. |
| `failure` | A run ends without reaching its target. |
| `reward` | An earned reward is granted. |
| `collectionUnlock` | A mastery, event, or journey collection milestone completes. |
| `rankPromotion` | The player's permanent rank rises. |
| `earth` | Earth-origin words receive a grounded identity accent. |
| `water` | Water-origin words receive a fluid identity accent. |
| `fire` | Fire-origin words receive an energized identity accent. |
| `air` | Air-origin words receive a light identity accent. |

Celestial Atlas uses rounded chime partials, Aurora Archive uses bright
inharmonic glass partials, and Solar Foundry uses warm analog harmonics plus
restrained mechanical noise. Lunar Garden uses soft, long-decay moon bells,
while Eclipse Sovereign uses lower inharmonic obsidian chimes and restrained
dark transients. Pixel Frontier uses gated pulse-wave chirps and tiny noise
transients, Bubble Reef uses elastic inharmonic bubble plucks and soft synthetic
splashes, and Stellar Vanguard uses short synthetic-brass calls with grounded
ceremonial transients.

At runtime, a word's stable normalized name adds a tiny deterministic pitch and
pan variation. Its semantic family adds a short material color:

- nature: lower, softer stone/water resonance;
- force: brighter, energized transient;
- life: warm organic lift;
- structure: grounded wood/metal register;
- celestial: high bell and shimmer.

This gives the word system audible identity without creating or shipping a
separate file for each of the game's more than one thousand concepts. New
discoveries receive a small resolving sparkle layered over the normal success
cue. The original oscillator cues remain as a low-latency fallback while a
bank is decoding or when a runtime asset cannot be reached.

## Reproduction

From the repository root:

```powershell
python scripts/build-audio-assets.py
node --test test/audio-assets.test.mjs
```

Regeneration requires Python with NumPy and an ffmpeg build containing
`libmp3lame`. The fixed `0xC057E110` random seed makes all synthesis choices and
PCM output repeatable. Encoder bytes may reflect the installed ffmpeg/LAME
version, so release validation checks format, declared inventory, duration
contract, and independent size ceilings rather than a tool-version-specific
hash.
