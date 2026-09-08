# Voyage Projection cinematic pipeline

The Voyage Projection is one film expressed through several delivery tiers, not a collection of unrelated intro clips. Its canonical timing, approved narration, shot order, render passes, fallback requirements, and rights gates live in [`scripts/voyage-projection-cinematic.v1.json`](../scripts/voyage-projection-cinematic.v1.json).

The current production contract intentionally validates without finished movie files. This lets the realtime projection ship and the pre-render work proceed without a placeholder video becoming an accidental release asset. A pre-render master is optional until it is explicitly selected for release; once selected, its media, captions, poster, voice rights, sound rights, and hashes must all pass the release gate. AI-tool terms, prompts, masks, and protected-pixel evidence become mandatory only when an optional AI finishing pass is explicitly enabled.

## Creative contract

The opening is a navigation projection, not a literal recording of the player's future. It begins at Earth, demonstrates the known solar route, crosses the heliopause, folds distance, reaches a black hole, and fails at the singularity. It returns to Earth with `DESTINATION UNRESOLVED / MAKE THE ROUTE` and hands control to the player. The completion variant reuses the same camera language and earned coordinates but emerges beyond the old boundary.

The full projection is 57 seconds at 24 fps:

| Time | Shot | Purpose |
| --- | --- | --- |
| 0–7 s | Earth | Wake the projection and establish human scale. |
| 7–20 s | Solar system | Materialize known coordinates; keep future worlds distant. |
| 20–27 s | Heliopause | Let familiar sunlight fall away. |
| 27–38 s | Warp | Fold distance using the route rather than camera shake. |
| 38–48 s | Black-hole approach | Bend the last known light around an unnamed destination. |
| 48–53 s | Singularity | Reach the projection's data boundary. |
| 53–57 s | Return or Beyond | Hand agency back to the player, or resolve the earned finale. |

The calm navigation intelligence speaks only the approved copy at the authored cue times:

1. “Every world we understand becomes somewhere we can reach.”
2. “Every discovery gives the voyage another coordinate.”
3. “Beyond the last light, the map has no word for what comes next.”
4. “So we will make one.”

The fourth line belongs to the unresolved Promise and Progress variants. The Completion finale continues beyond the singularity without repeating it.

## What AI may and may not do

The authored 3D scene is the source of truth. It owns:

- camera position, lens, cuts, roll, and timing;
- rocket geometry, silhouette, transforms, exhaust sockets, and motion;
- planets, limbs, landmarks, orbit paths, scale, and occlusion;
- the route spline, physics, typography, captions, and narration timing.

AI is an optional finishing tool for isolated VFX layers. It may enhance only the declared far-field nebula, star haze, dust, warp caustics, accretion glow, singularity corona, and beyond color field. Every AI layer must:

1. start from a separately rendered authoritative matte;
2. preserve alpha and remain a separate EXR layer;
3. be composited over the authoritative 3D beauty pass;
4. change zero protected pixels under the authoritative object-ID comparison;
5. record provider, exact model/version, commercial terms, generation date, seed, prompt, input/output hashes, mask hash, and human approval;
6. be removable without changing camera continuity, object continuity, story timing, or gameplay state.

Full-frame image-to-video generation, AI camera interpolation, AI stabilization, rocket or planet regeneration, generated typography, performer imitation, and generated in-picture text are prohibited. If an AI VFX layer fails, the clean 3D render remains the valid film.

## Render and composite workflow

1. **Lock animatic.** Work at 24 fps with the contract's exact frame boundaries. Review camera comfort, rocket silhouette, planet scale, occlusion, and route continuity before any finishing pass.
2. **Bake motion.** Bake particles and simulations with seed `314159`. No final render depends on a live random simulation.
3. **Render authority package.** Export beauty, depth, normals, motion vectors, object IDs, and the declared VFX mattes as frame-numbered OpenEXR sequences. Preserve the same camera and frame range across every pass.
4. **Produce optional AI layers.** Feed only the matching masked region to the selected commercial-use tool. Keep the source matte outside the promptable image and save an alpha-bearing result. Never ask the tool to repair or reinterpret protected geometry.
5. **Composite.** Place masked VFX over the unmodified beauty pass using only the contract's `over`, `screen`, or `add` operation. Compare protected object IDs before and after; the permitted delta is zero pixels.
6. **Record narration.** Use an original performance or a commercially licensed synthetic voice that does not imitate a living performer. Conform to the authored cue times rather than time-stretching the picture around the voice.
7. **Mix and caption.** Master at 48 kHz / 24-bit, retain at least 1 dB peak headroom, and author English WebVTT from the approved text. Captions remain available even if the film also renders readable subtitles.
8. **Export.** Produce 4K ProRes 4444 XQ masters in ACEScg/Rec.709-managed color, then derive 1080p H.264 and VP9 web files. Generate the three 1920x1080 WebP posters from the same graded composites at frames 168, 912, and 1272, never from a separate AI prompt. Each poster is capped at 650,000 bytes and the pack at 1,950,000 bytes.
9. **Review.** Sign off creative, continuity, accessibility, and rights/provenance gates. Compare the opening and finale at the manifest's fixed frames to prove they are two outcomes of one voyage.

## Delivery behavior

- **Realtime:** Promise, Progress, and Completion use the current deterministic Three.js projection and the player's actual progression state.
- **Pre-render opening:** the hyperreal Promise master can replace the realtime first-open presentation after its rights and media gates pass.
- **Pre-render finale:** the Completion master is an earned cinematic; it does not mutate or invent progression.
- **Reduced motion:** a 24-second, crossfade-only presentation with transitions capped at 180 ms. It retains narration, captions, skip, and outcome.
- **Poster:** opening, progress, and finale posters preserve the same composition for WebGL/media failure, save-data mode, offline startup, and forced fallback. A poster is releasable only when its sidecar evidence matches the current contract digest, source composite SHA-256, delivered poster SHA-256, locked extraction frame, and human approval.

Replay never records an expedition arrival, unlocks a world, or changes score. Skip reaches the same non-gameplay cinematic acknowledgement as natural completion. The opening/finale master is a presentation layer over the authoritative game state.

## Deterministic preproduction scaffold

Generate the production paperwork directly from the locked contract before rendering any media:

```powershell
npm run cinematic:voyage:scaffold
```

The command writes frame-exact timelines, a combined shot/narration cue sheet, opening and finale CMX-style EDLs, authoritative render jobs, compositor jobs, executable poster extraction arguments, source hashes, English WebVTT captions, and blank provenance checklists. It includes a dedicated authoritative Progress render/composite at frame 912 rather than requesting a poster from a nonexistent sequence. The generated scaffold is intentionally timestamp-free and byte reproducible. Verify that committed/generated copies have not drifted with:

```powershell
npm run cinematic:voyage:scaffold:verify
```

Machine-readable production files live under `production/voyage-projection/scaffold`. The two generated caption files use the delivery paths declared by the contract under `public/cinematic`. Narration seconds remain authoritative in WebVTT; the cue sheet also records nearest-frame quantization at 24 fps so an editor never has to infer a frame boundary.

The scaffold creates no images, movies, audio, voice, AI output, licenses, or rights claims. Every optional AI layer begins disabled, every provider/output/approval field remains null, and the protected-pixel allowance remains zero. `clean-authored-3d` is the compositor default, but the final release validator still blocks undocumented voice and sound production. Enabling any optional AI layer additionally requires its completed per-shot/per-pass evidence and protected-pixel review; a blank template is never approval. The generated poster-evidence template is likewise blocking until it is copied to the declared evidence path and completed from real graded composites.

Non-shipping VFX look-development references live under `production/voyage-projection/lookdev`. Their manifest fixes prompts, dimensions, hashes, allowed VFX elements, `releaseEligible: false`, and the canonical contract ID, version, and digest. The look-development verifier rejects a stale contract binding, so a visual reference cannot silently outlive the authority policy that permitted it. These references guide the far-field, warp, and singularity finish but cannot replace alpha-bearing matte-constrained production layers or graded-master posters.

## Executable local production path

The authoritative runtime can now be sampled into frame-exact offline plans and rendered by pinned Blender 5.1.2 without a browser capture:

```powershell
npm run cinematic:voyage:offline:preflight
npm run cinematic:voyage:offline:smoke
node scripts/voyage-projection-offline-render.mjs review --width=1920 --height=1080 --samples=32
```

Smoke and review output stays under `.codex-tmp`, sets `releaseEligible: false`, and produces a hash-bound technical report. A production render additionally requires `--confirm-production` and a project-owned ACES OCIO configuration in `OCIO`; the command refuses to infer or silently substitute color authority. The renderer imports the optimized project Earth, Moon, Sun, and rocket GLBs, builds the remaining systems procedurally, and emits deterministic geometry and pass data from the exact runtime frame state.

Original, sample-free score and sound-design guides can be regenerated and verified independently:

```powershell
npm run cinematic:voyage:audio:guide
npm run cinematic:voyage:audio:verify
```

These four 57-second stereo PCM24/48 kHz stems are explicitly voice-free, non-final, and not release-eligible. They establish editable timing and variant-specific endings without fabricating a performer release, final mix approval, or commercial voice rights.

Project-authored Promise and Completion review-master candidates can then be mixed, loudness-normalized, and independently measured from those stems:

```powershell
npm run cinematic:voyage:audio:review
npm run cinematic:voyage:audio:review:verify
```

The candidates remain under `output/voyage-projection/audio/review`, never populate the compositor's final opening/finale master paths, and reserve narration space through smooth score/SFX automation. Their provenance records gated integrated loudness, sample peak, a transparent 4× intersample true-peak estimate, deterministic source hashes, and project-authored/sample-free lineage. Reproduction is deliberately pinned to CPython 3.14.0, NumPy 2.5.0, and explicit PCG64; unsupported environments are rejected before media I/O, the known candidate hashes are locked, and symlink/junction/reparse-point paths fail closed. They still contain no voice and remain review-only until licensed narration, calibrated final metering, and recorded human approval exist.

Render a complete, resumable, non-shipping Promise/Completion picture review with the dedicated orchestrator:

```powershell
node scripts/voyage-projection-full-review-render.mjs --confirm=CONFIRM_NONSHIPPING_FULL_VOYAGE_REVIEW --width=1920 --height=1080 --samples=32 --resume
```

It renders Promise frames `0000-1367`, renders only Completion's divergent `1272-1367` finale, and materializes two flat 1,368-frame timelines using verified hardlinks where possible. Existing frames, immutable plans, renderer reports, exact controlled sample counts, dimensions, hashes, per-frame non-black luminance evidence, and the resumable session must agree. Each contiguous shot is fully decoded through FFmpeg and downsampled only for validation; a corrupt or wholly black shot and distinct shot IDs collapsed to one frame hash are rejected. Clean renderer reports explicitly set `lookdevPlatesEnabled: false`. A future explicit review-only plate mode may set it true only when the report binds the verified lookdev manifest and each used plate by exact path/hash and records `underlay` composition; it remains watermarked and non-shipping. The resulting report does not claim final color, sound, rights, protected-pixel, creative, or accessibility approval.

### Non-shipping review candidates

The compositor has a separate review-candidate tier for watching a complete authored cut before final color, voice, sound, provenance, and human approvals exist. The sampled `.codex-tmp` offline-render review remains useful for look development; it is not a complete timeline and cannot enter this tier. Supply complete frames `0000` through `1367` for both Promise and Completion as PNG or EXR sequences under `output/voyage-projection/`, plus one or more of the verified project-owned voice-free PCM24/48 kHz guide stems.

A candidate descriptor uses this fail-closed shape (repeat the audio record for each score/SFX stem):

```json
{
  "schemaVersion": 1,
  "kind": "voyage-review-candidate",
  "candidateId": "lighting-pass-03",
  "contractSha256": "CURRENT_64_CHARACTER_CONTRACT_SHA256",
  "releaseEligible": false,
  "shipping": false,
  "cleanAuthored3d": true,
  "aiLayersEnabled": false,
  "durationSeconds": 57,
  "frameCount": 1368,
  "fps": 24,
  "audioGuideRecord": {
    "path": "production/voyage-projection/scaffold/provenance/audio-guide-record.json",
    "sha256": "CURRENT_64_CHARACTER_RECORD_SHA256"
  },
  "variants": {
    "promise": {
      "authoredTimeline": true,
      "framePattern": "output/voyage-projection/review-renders/promise/frame-%04d.png",
      "audio": [{
        "path": "output/voyage-projection/audio/stems/voyage-projection-score-unresolved-guide.wav",
        "sha256": "CURRENT_64_CHARACTER_FILE_SHA256"
      }]
    },
    "completion": {
      "authoredTimeline": true,
      "framePattern": "output/voyage-projection/review-renders/completion/frame-%04d.exr",
      "exrColor": {
        "sourceColorSpace": "ACEScg",
        "viewTransformApplied": true,
        "viewTransform": "ACES 1.3 Output - Rec.709 Gamma 2.4",
        "deliveryColorSpace": "Rec.709 Gamma 2.4",
        "evidence": {
          "path": "production/voyage-projection/review-exr-color-evidence.json",
          "sha256": "CURRENT_64_CHARACTER_EVIDENCE_SHA256"
        }
      },
      "audio": [{
        "path": "output/voyage-projection/audio/stems/voyage-projection-score-completion-guide.wav",
        "sha256": "CURRENT_64_CHARACTER_FILE_SHA256"
      }]
    }
  }
}
```

Preflight and explicitly encode it with:

```powershell
node scripts/voyage-projection-compositor.mjs --review-candidate production/voyage-projection/review-candidate.local.json --json
node scripts/voyage-projection-compositor.mjs --review-candidate production/voyage-projection/review-candidate.local.json --execute-review-candidate --confirm CONFIRM_NONSHIPPING_VOYAGE_REVIEW
```

The candidate's audio record hash is mandatory. Every declared stem path/hash must exactly match a voice-free, guide-only, variant-compatible entry in that independently verified record; self-asserted `projectOwned` or `voiceFree` booleans are not provenance. PNG and EXR inputs are fully decoded, and EXR additionally requires hash-bound evidence that a named ACEScg-to-Rec.709 Gamma 2.4 view transform was already applied. Real paths are checked against the project root, including parent junctions and symlinks.

The encoder mixes multiple declared guide stems when present and emits H.264/AAC MP4, VP9/Opus WebM, and locked-frame WebP posters only beneath `output/voyage-projection/review-candidates/<candidateId>/`. It encodes into a private staging directory, fully decodes and probes the staged artifact, validates exact stream count/codecs, 1920x1080 geometry, 24 fps, 1,368 frames/57 seconds, 48 kHz stereo, and non-shipping metadata, then promotes without overwrite. A failed artifact is never promoted; completed artifacts and deterministic `.review.json` sidecars make a later run resumable. Every artifact carries a visible `NON-SHIPPING REVIEW` watermark and remains non-release. The review descriptor has no approval schema, cannot write `public/`, cannot update `voyage-projection-media.json`, and is rejected if passed to the final encode prerequisite gate. Reviewing it never documents navigation-voice or score-and-sound-design rights.

The clean compositor and encoder preflight is executable but fail-closed:

```powershell
npm run cinematic:voyage:production:preflight
```

It validates every numbered EXR and hash, permits zero protected-pixel changes, rejects every enabled AI layer in clean mode, and plans exact 1,368-frame H.264/AAC MP4 plus VP9/Opus WebM deliveries. Clean copying and final encoding use separate explicit confirmation tokens and never overwrite a different existing output. The final encode remains blocked until graded timeline hashes, an approved ACEScg-to-Rec.709 transform, real mastered audio, provenance records, and creative/continuity/accessibility/rights approvals exist.

`public/cinematic/voyage-projection-media.json` is the last runtime boundary. Schema v2 ships disabled. Only a contract-v1.2-matching record with exact duration/frame metadata, distinct SHA-256 evidence for the master, MP4, WebM, poster, and captions, plus auditable human-approval objects at both manifest and variant level enables master playback. Boolean approval shortcuts and reused hashes fail closed. Otherwise the accessible projection shell falls back to realtime, poster, or the established legacy film.

## Validation

Validate the contract and current required realtime files:

```powershell
npm run cinematic:voyage:verify
```

Emit a machine-readable report:

```powershell
node scripts/voyage-projection-production.mjs --json
```

Run the final rights gate after provider, voice, and sound provenance are documented:

```powershell
node scripts/voyage-projection-production.mjs --release
```

Require all optional pre-render masters, web encodes, captions, and posters when promoting them into the product:

```powershell
node scripts/voyage-projection-production.mjs --release --include-optional-media
```

The last two commands are expected to fail while provenance records remain `pending-*` or media is absent. That failure is intentional: a visually complete file is not a releasable file until the production evidence is complete.

## Per-generation provenance record

For every accepted AI-assisted layer, copy this record into the production log and replace every placeholder:

```json
{
  "shotId": "black-hole",
  "passId": "ai-accretion-glow",
  "provider": "REQUIRED",
  "model": "REQUIRED",
  "modelVersion": "REQUIRED",
  "generatedAt": "YYYY-MM-DDTHH:mm:ssZ",
  "commercialTermsEvidence": "REQUIRED",
  "seed": 314159,
  "prompt": "REQUIRED",
  "negativePrompt": "no camera change, no rocket, no planet limb, no text",
  "inputSha256": "REQUIRED",
  "maskSha256": "REQUIRED",
  "outputSha256": "REQUIRED",
  "humanApproval": {
    "reviewer": "REQUIRED",
    "approvedAt": "YYYY-MM-DDTHH:mm:ssZ",
    "protectedPixelChanges": 0
  }
}
```

Do not place API keys, private account identifiers, or subscription receipts containing personal data in this record. Link to a redacted rights artifact instead.
