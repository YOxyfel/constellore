# Voyage Projection VFX look development

These four plates define the approved visual target for the AI-permitted
atmosphere layers in the Voyage Projection. They are intentionally stored under
`production/`, never `public/`, and are not runtime or release assets.

The authoritative 3D render continues to own the camera, rocket, planet
geometry and limbs, orbits, route spline, occlusion, scale, physics, typography,
and timing. A compositor may use these images only as references when creating
separate alpha-bearing VFX layers constrained by the final object-ID matte.

They may not be used as the opening, progress, or finale posters. Those posters
must be frames extracted from the final graded master so fallback composition
cannot drift from the movie or realtime scene.

Files:

- `vfx-lookdev-far-field-nebula.png` — far-field nebula, star haze, and dust.
- `vfx-lookdev-warp-caustics.png` — gravitational refraction and warp caustics.
- `vfx-lookdev-singularity-corona.png` — accretion glow, corona, and beyond field.
- `vfx-lookdev-beyond-color-field.png` — background-only earned-completion depth field.

Generation prompts, dimensions, byte sizes, and SHA-256 hashes are recorded in
`lookdev-manifest.json`. The manifest also records the canonical production
contract ID, version, and digest; validation fails as soon as those references
drift from the current contract. Before any derived layer can ship, replace the pending
`ai-vfx-renderer` provenance record with the provider terms, prompt, source and
output hashes, authoritative matte hash, and protected-pixel comparison result.
